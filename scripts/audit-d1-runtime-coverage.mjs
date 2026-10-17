#!/usr/bin/env node
// Offline-only inventory for the D1 migration. Never contacts a database or provider.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '.next', '.open-next', '.generated', '.vercel', 'coverage', 'dist', 'build']);
const textFile = /(?:\.(?:ts|tsx|js|jsx|mjs|cjs|sql|json|jsonc|md|yml|yaml|toml|sh|env|txt)|\.example)$/i;
const files = [];

async function walk(directory = '') {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await walk(relative);
    else if (entry.isFile() && textFile.test(entry.name)) files.push(relative);
  }
}

function classifySupabaseReference(file) {
  if (file.startsWith('.github/workflows/')) return 'active-workflow';
  if (file.startsWith('deploy/installations/') || file.startsWith('deploy/platforms/') || /(?:^|\/)(?:\.env|.*\.example)$/.test(file)) return 'active-config';
  if (file.startsWith('src/') || file === 'package.json' || file === 'package-lock.json') return 'active-runtime';
  if (file.startsWith('tests/')) return 'test-fixture';
  if (file === 'scripts/audit-d1-runtime-coverage.mjs') return 'audit-tool';
  if (/^docs\/superpowers\/(?:specs|plans)\//.test(file)) return 'historical-design';
  if (file.startsWith('docs/')) return 'operator-documentation';
  if (file === 'AGENTS.md' || file === 'agentmklms.md') return 'repository-guidance';
  return 'other';
}

await walk();
files.sort();

const routes = files.filter((file) => /^src\/app\/.*\/route\.tsx?$/.test(file));
const postgresRepositoryFiles = files.filter((file) => /^src\/features\/.*\/repositories\/postgres-.*\.ts$/.test(file));
const d1RepositoryFiles = files.filter((file) => /^src\/features\/.*\/repositories\/d1-.*\.repository\.ts$/.test(file));
const repositoryOverrides = new Map([
  ['src/features/media/repositories/postgres-video-progress.repository.ts', 'src/features/media/repositories/d1-media-playback.repository.ts'],
]);
const repositoryPairs = postgresRepositoryFiles.map((postgres) => ({
  postgres,
  d1: repositoryOverrides.get(postgres) ?? postgres.replace('/postgres-', '/d1-'),
}));
const pairedD1Files = new Set(repositoryPairs.map((pair) => pair.d1));
const repositoryCoverage = {
  postgresCount: postgresRepositoryFiles.length,
  d1Count: d1RepositoryFiles.length,
  pairs: repositoryPairs.filter((pair) => d1RepositoryFiles.includes(pair.d1)),
  unmappedPostgres: repositoryPairs.filter((pair) => !d1RepositoryFiles.includes(pair.d1)),
  unmappedD1: d1RepositoryFiles.filter((file) => !pairedD1Files.has(file)),
};
const repositoryClassSources = new Map();
for (const file of [...postgresRepositoryFiles, ...d1RepositoryFiles]) {
  const contents = await readFile(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const node of source.statements) {
    if (!ts.isClassDeclaration(node) || !node.name) continue;
    repositoryClassSources.set(node.name.text, { file, node });
  }
}
function publicRepositoryMethods(className, seen = new Set()) {
  if (seen.has(className)) return new Set();
  seen.add(className);
  const entry = repositoryClassSources.get(className);
  if (!entry) return new Set();
  const methods = new Set();
  const heritage = entry.node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
  const parent = heritage?.types[0]?.expression;
  if (parent && ts.isIdentifier(parent)) {
    for (const method of publicRepositoryMethods(parent.text, seen)) methods.add(method);
  }
  for (const member of entry.node.members) {
    if (!ts.isMethodDeclaration(member) || !member.name || ts.isPrivateIdentifier(member.name)) continue;
    const modifiers = ts.getModifiers(member) ?? [];
    if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.StaticKeyword)) continue;
    if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) methods.add(member.name.text);
  }
  return methods;
}
const repositoryMethodParity = repositoryCoverage.pairs.map(({ postgres, d1 }) => {
  const postgresClass = [...repositoryClassSources].find(([name, source]) => source.file === postgres && name.startsWith('Postgres'))?.[0];
  const d1Class = [...repositoryClassSources].find(([name, source]) => source.file === d1 && name.startsWith('D1'))?.[0];
  const postgresMethods = postgresClass ? publicRepositoryMethods(postgresClass) : new Set();
  const d1Methods = d1Class ? publicRepositoryMethods(d1Class) : new Set();
  return {
    postgres,
    d1,
    postgresClass,
    d1Class,
    missingInD1: [...postgresMethods].filter((method) => !d1Methods.has(method)).sort(),
    d1Only: [...d1Methods].filter((method) => !postgresMethods.has(method)).sort(),
    postgresMethodCount: postgresMethods.size,
    d1MethodCount: d1Methods.size,
  };
});
const runtimeReferences = [];
const runtimeBackendFactories = [];
const runtimeRawDatabaseAccess = [];
const runtimeRepositoryConstructions = [];
const routeDatabaseCallSites = { postgres: [], d1: [] };
const routeRepositoryCounts = {
  postgresql: { total: 0, counts: {} },
  d1: { total: 0, counts: {} },
};
const supabaseReferences = [];

for (const file of files) {
  const contents = await readFile(path.join(root, file), 'utf8');
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (
      (file.startsWith('src/app/') || file.startsWith('src/features/')) &&
      !file.includes('/repositories/')
    ) {
      const directConstruction = line.match(/\bnew\s+((?:Postgres|D1)\w*Repository)\s*\(/);
      if (directConstruction) {
        runtimeRepositoryConstructions.push({
          path: file,
          line: index + 1,
          repository: directConstruction[1],
        });
      }
    }
    if (routes.includes(file)) {
      const postgresConstruction = line.match(/\bnew\s+(Postgres\w*Repository)\s*\(/);
      if (postgresConstruction) {
        routeDatabaseCallSites.postgres.push({ path: file, line: index + 1 });
        routeRepositoryCounts.postgresql.total++;
        routeRepositoryCounts.postgresql.counts[postgresConstruction[1]] =
          (routeRepositoryCounts.postgresql.counts[postgresConstruction[1]] ?? 0) + 1;
      }
      const d1Construction = line.match(/\bnew\s+(D1\w*Repository)\s*\(/);
      if (d1Construction) {
        routeDatabaseCallSites.d1.push({ path: file, line: index + 1 });
        routeRepositoryCounts.d1.total++;
        routeRepositoryCounts.d1.counts[d1Construction[1]] =
          (routeRepositoryCounts.d1.counts[d1Construction[1]] ?? 0) + 1;
      }
    }
    if (file.startsWith('src/') && /Postgres\w*Repository|getPostgresPool|DATABASE_URL|HYPERDRIVE_(?:FRESH|CACHED)/.test(line)) {
      runtimeReferences.push({ path: file, line: index + 1 });
    }
    if ((file.startsWith('src/app/') || file.startsWith('src/features/')) && !file.includes('/repositories/')) {
      if (/create(?:Postgres|D1)\w*Repository\s*\(/.test(line) || /createDatabaseRepositories\s*\(/.test(line)) {
        runtimeBackendFactories.push({ path: file, line: index + 1 });
      }
      if (/get(?:Cached)?PostgresPool\s*\(|\b(?:DATABASE_URL|HYPERDRIVE_(?:FRESH|CACHED))\b/.test(line)) {
        runtimeRawDatabaseAccess.push({ path: file, line: index + 1 });
      }
    }
    if (/supabase/i.test(line)) {
      supabaseReferences.push({ path: file, line: index + 1, classification: classifySupabaseReference(file) });
    }
  }
}

const productionWorkflows = files.filter((file) =>
  /^\.github\/workflows\/(?:release-starpips-production|mkety-academy-release)\.yml$/.test(file));
const migrationFiles = files.filter((file) => /^db\/(?:d1-migrations|migrations)\/.*\.sql$/.test(file));
function groupLinesByPath(items, includeClassification = false) {
  const grouped = new Map();
  for (const item of items) {
    let group = grouped.get(item.path);
    if (!group) {
      group = { path: item.path, lines: [] };
      if (includeClassification) group.classification = item.classification;
      grouped.set(item.path, group);
    }
    group.lines.push(item.line);
  }
  return [...grouped.values()].sort((left, right) => left.path.localeCompare(right.path));
}
const countByClass = Object.fromEntries([...new Set(supabaseReferences.map((item) => item.classification))]
  .sort().map((classification) => [classification, supabaseReferences.filter((item) => item.classification === classification).length]));

console.log(JSON.stringify({
  mode: 'offline-read-only',
  routes: { count: routes.length, files: routes },
  repositoryCoverage,
  repositoryMethodParity,
  routeDatabaseCallSites: { ...routeDatabaseCallSites, byRepositoryClass: routeRepositoryCounts },
  runtimeRepositoryConstructions,
  runtimeBackendFactories,
  runtimeRawDatabaseAccess,
  runtimeDatabaseReferences: {
    postgresRepositoryFiles,
    postgresRepositoryReferences: runtimeReferences.length,
    postgresRepositoryReferenceFiles: groupLinesByPath(runtimeReferences),
  },
  migrations: { count: migrationFiles.length, files: migrationFiles },
  productionWorkflows,
  supabase: {
    total: supabaseReferences.length,
    countByClass,
    references: groupLinesByPath(supabaseReferences, true),
  },
}, null, 2));
