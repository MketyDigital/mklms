import { readFile, writeFile } from 'node:fs/promises';
import { materializeInstallationManifest } from './materialize-installation-manifest.mjs';

const proposalPath = process.argv[2] ?? 'deploy/proposals/mkety-academy.json';
const resultPath = process.argv[3] ?? '.generated/provisioning/mkety-academy.json';
const outputPath = process.argv[4] ?? '.generated/provisioning/mkety-academy.manifest.json';

try {
  const proposal = JSON.parse(await readFile(proposalPath, 'utf8'));
  const provisioning = JSON.parse(await readFile(resultPath, 'utf8'));
  const manifest = materializeInstallationManifest(proposal, provisioning);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Materialized safe Mkety manifest at ${outputPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
