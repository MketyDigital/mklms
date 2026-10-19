import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('read-only D1 coverage audit inventories runtime database paths and Supabase references', () => {
  const result = spawnSync(process.execPath, ['scripts/audit-d1-runtime-coverage.mjs'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'offline-read-only');
  assert.ok(report.routes.count >= 1);
  assert.equal(report.repositoryCoverage.unmappedPostgres.length, 0);
  assert.equal(report.repositoryCoverage.unmappedD1.length, 0);
  assert.equal(report.repositoryCoverage.postgresCount, 19);
  assert.equal(report.repositoryCoverage.d1Count, 18);
  assert.equal(report.repositoryMethodParity.length, 19);
  assert.deepEqual(report.repositoryMethodParity.filter((pair) => pair.missingInD1.length > 0), []);
  assert.equal(report.routeDatabaseCallSites.postgres.length, 0);
  assert.equal(report.routeDatabaseCallSites.postgres.length, 0);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.total, 0);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresSettingsRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresAdminLearningRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresLearningRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresAccessRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresAdminAccessRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresMessageRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresCertificateRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresCertificateTemplateRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresQuizRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresCourseAudienceRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresPaidLiveRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresLiveClassRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresAdminLiveClassRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresAdminMediaRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresMediaIngestRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresMediaPlaybackRepository, undefined);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts.PostgresVideoProgressRepository, undefined);
  assert.equal(Object.keys(report.routeDatabaseCallSites.byRepositoryClass.postgresql.counts).length, 0);
  assert.equal(report.routeDatabaseCallSites.byRepositoryClass.d1.total, 0);
  assert.equal(report.routeDatabaseCallSites.d1.length, 0);
  assert.deepEqual(report.runtimeRepositoryConstructions, []);
  assert.ok(report.runtimeBackendFactories.length > 0);
  assert.ok(report.runtimeRawDatabaseAccess.every((item) =>
    item.path === 'src/app/(admin)/admin/settings/page.tsx' ||
    item.path === 'src/app/(public)/live/[slug]/page.tsx' ||
    item.path === 'src/app/layout.tsx' ||
    item.path === 'src/features/settings/integration-status.ts'));
  assert.ok(report.routeDatabaseCallSites.postgres.every((item) => item.path.startsWith('src/app/')));
  assert.ok(report.runtimeDatabaseReferences.postgresRepositoryReferenceFiles.length > 0);
  assert.ok(report.supabase.references.some((item) =>
    item.path === 'docs/superpowers/specs/2026-10-17-d1-first-migration-design.md' && item.classification === 'historical-design'));
  assert.ok(!report.supabase.references.some((item) =>
    item.classification === 'active-config' || item.classification === 'active-runtime' ||
    (item.classification === 'active-workflow' && item.path !== '.github/workflows/phase1-ci.yml')));
  assert.ok(report.productionWorkflows.includes('.github/workflows/release-starpips-production.yml'));
  assert.ok(report.productionWorkflows.includes('.github/workflows/mkety-academy-release.yml'));
});
