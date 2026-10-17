import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtime repository registry pairs every persistence domain to both database backends', async () => {
  const source = await readFile(new URL('../src/lib/database-repositories.ts', import.meta.url), 'utf8');
  const expected = [
    ['access', 'PostgresAccessRepository', 'D1AccessRepository'],
    ['adminAccess', 'PostgresAdminAccessRepository', 'D1AdminAccessRepository'],
    ['certificateTemplates', 'PostgresCertificateTemplateRepository', 'D1CertificateTemplateRepository'],
    ['certificates', 'PostgresCertificateRepository', 'D1CertificateRepository'],
    ['adminLearning', 'PostgresAdminLearningRepository', 'D1AdminLearningRepository'],
    ['courseAudience', 'PostgresCourseAudienceRepository', 'D1CourseAudienceRepository'],
    ['learning', 'PostgresLearningRepository', 'D1LearningRepository'],
    ['hosting', 'PostgresManagedHostingRepository', 'D1ManagedHostingRepository'],
    ['hostingLedger', 'PostgresManagedHostingLedgerRepository', 'D1ManagedHostingLedgerRepository'],
    ['adminLiveClass', 'PostgresAdminLiveClassRepository', 'D1AdminLiveClassRepository'],
    ['liveClass', 'PostgresLiveClassRepository', 'D1LiveClassRepository'],
    ['adminMedia', 'PostgresAdminMediaRepository', 'D1AdminMediaRepository'],
    ['mediaIngest', 'PostgresMediaIngestRepository', 'D1MediaIngestRepository'],
    ['mediaPlayback', 'PostgresMediaPlaybackRepository', 'D1MediaPlaybackRepository'],
    ['videoProgress', 'PostgresVideoProgressRepository', 'D1MediaPlaybackRepository'],
    ['messages', 'PostgresMessageRepository', 'D1MessageRepository'],
    ['paidLive', 'PostgresPaidLiveRepository', 'D1PaidLiveRepository'],
    ['quizzes', 'PostgresQuizRepository', 'D1QuizRepository'],
    ['settings', 'PostgresSettingsRepository', 'D1SettingsRepository'],
  ];
  for (const [name, postgresClass, d1Class] of expected) {
    assert.match(source, new RegExp(`\\b${name}:\\s*\\{`), `missing ${name} registry entry`);
    const entry = source.match(new RegExp(`\\b${name}:\\s*\\{[^}]+\\}`))?.[0];
    assert.ok(entry, `could not read ${name} registry entry`);
    assert.ok(entry.includes(`new ${postgresClass}(`), `${name} maps to the wrong PostgreSQL repository`);
    assert.ok(entry.includes(`new ${d1Class}(`), `${name} maps to the wrong D1 repository`);
  }
  assert.equal((source.match(/postgresql:\s*\(/g) ?? []).length, expected.length);
  assert.equal((source.match(/d1:\s*\(/g) ?? []).length, expected.length);
});

test('selected D1 repository composition wraps atomic batches for replication transaction capture', async () => {
  const source = await readFile(new URL('../src/lib/database-repositories.ts', import.meta.url), 'utf8');
  assert.match(source, /withReplicationCaptureBatch\(dependencies\.d1,\s*\(\)\s*=>\s*globalThis\.crypto\.randomUUID\(\)\)/);
  assert.match(source, /createRepositorySetForBackend\([\s\S]*?\.\.\.dependencies,\s*d1:\s*replicationAwareD1\s*\}/);
});
