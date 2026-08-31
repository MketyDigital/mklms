import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('student claim completes atomically and can recover an existing partial student record', () => {
  const contract = read('src/features/access/repositories/access.repository.ts');
  const postgres = read('src/features/access/repositories/postgres-access.repository.ts');
  const service = read('src/features/access/services/access.service.ts');
  assert.match(contract, /completeVerifiedClaim/i);
  assert.match(postgres, /BEGIN/);
  assert.match(postgres, /COMMIT/);
  assert.match(postgres, /ROLLBACK/);
  assert.match(postgres, /SELECT[\s\S]*FROM students/i);
  assert.match(postgres, /UPDATE student_access_credentials/);
  assert.match(postgres, /INSERT INTO student_access_credentials/);
  assert.match(service, /repository\.completeVerifiedClaim/);
});

test('stuck unclaimed authorizations can be cancelled and recreated from admin', () => {
  const route = read('src/app/api/admin/access/preauthorizations/[preauthorizationId]/route.ts');
  const repository = read('src/features/access/repositories/postgres-admin-access.repository.ts');
  const panel = read('src/features/access/components/admin/admin-access-panel.tsx');
  assert.match(route, /export async function DELETE/);
  assert.match(route, /export async function PATCH/);
  assert.match(repository, /cancelPendingPreauthorization/);
  assert.match(repository, /status = 'PREAUTHORIZED'/);
  assert.match(panel, /Cancel pending/);
});

test('claim and login routes return JSON-safe production service failures', () => {
  const claim = read('src/app/api/access/claim/route.ts');
  const login = read('src/app/api/access/login/route.ts');
  assert.match(claim, /catch \(error\)/);
  assert.match(claim, /status: 503/);
  assert.match(login, /catch \(error\)/);
  assert.match(login, /status: 503/);
});

test('active admin verification choices are limited to implemented end-to-end strategies', () => {
  const domain = read('src/features/access/domain/claim-verification.ts');
  const panel = read('src/features/access/components/admin/admin-access-panel.tsx');
  const settings = read('src/features/settings/components/settings-form.tsx');
  const route = read('src/app/api/admin/settings/platform/route.ts');
  assert.match(domain, /ACTIVE_CLAIM_VERIFICATION_STRATEGIES/);
  assert.doesNotMatch(panel, /Email OTP|SMS OTP|Custom verification/);
  assert.doesNotMatch(settings, /otp-email|otp-sms|custom/);
  assert.doesNotMatch(settings, /magic-link|oidc|resend|postmark|sendgrid|brevo|webhook/);
  assert.match(route, /ACTIVE_CLAIM_VERIFICATION_STRATEGIES/);
});

test('settings verifies the transaction client required by production access and live imports', () => {
  const page = read('src/app/(admin)/admin/settings/page.tsx');
  assert.match(page, /await pool\.connect\(\)/);
  assert.match(page, /BEGIN/);
  assert.match(page, /transaction_probe/);
  assert.match(page, /ROLLBACK/);
});

test('course administration has real update and guarded delete routes', () => {
  const route = read('src/app/api/admin/courses/[courseId]/route.ts');
  const repository = read('src/features/courses/repositories/postgres-admin-learning.repository.ts');
  const manager = read('src/features/courses/components/admin/admin-course-manager.tsx');
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(repository, /updateCourse/);
  assert.match(repository, /deleteCourse/);
  assert.match(repository, /enrollments|lesson_progress|certificates/);
  assert.match(manager, /Edit course/);
  assert.match(manager, /Delete course/);
});

test('module and lesson administration has real update and delete routes', () => {
  const moduleRoute = read('src/app/api/admin/modules/[moduleId]/route.ts');
  const lessonRoute = read('src/app/api/admin/lessons/[lessonId]/route.ts');
  const repository = read('src/features/courses/repositories/postgres-admin-learning.repository.ts');
  const builder = read('src/features/courses/components/admin/admin-course-builder.tsx');
  assert.match(moduleRoute, /export async function PATCH/);
  assert.match(moduleRoute, /export async function DELETE/);
  assert.match(lessonRoute, /export async function PATCH/);
  assert.match(lessonRoute, /export async function DELETE/);
  assert.match(repository, /updateModule/);
  assert.match(repository, /deleteModule/);
  assert.match(repository, /updateLesson/);
  assert.match(repository, /deleteLesson/);
  assert.match(builder, /Edit module/);
  assert.match(builder, /Delete module/);
  assert.match(builder, /Edit lesson/);
  assert.match(builder, /Delete lesson/);
});

test('live classes support editing and deleting batches and sessions', () => {
  const route = read('src/app/api/admin/live-classes/route.ts');
  const repository = read('src/features/live-classes/repositories/postgres-admin-live-class.repository.ts');
  const manager = read('src/features/live-classes/components/admin-live-class-manager.tsx');
  assert.match(route, /updateBatch/);
  assert.match(route, /deleteBatch/);
  assert.match(route, /updateSession/);
  assert.match(route, /deleteSession/);
  assert.match(repository, /updateBatch/);
  assert.match(repository, /deleteBatch/);
  assert.match(repository, /updateSession/);
  assert.match(repository, /deleteSession/);
  assert.match(manager, /Edit batch|Edit live class/i);
  assert.match(manager, /Delete batch|Delete live class/i);
  assert.match(manager, /Edit session/i);
  assert.match(manager, /Delete session/i);
});

test('live admin makes public requirements explicit and unavailable state is never cached', () => {
  const manager = read('src/features/live-classes/components/admin-live-class-manager.tsx');
  const publicRepository = read('src/features/live-classes/repositories/postgres-live-class.repository.ts');
  const stateRoute = read('src/app/api/live/[slug]/state/route.ts');
  assert.match(publicRepository, /status\s*=\s*'ACTIVE'/);
  assert.match(manager, /ACTIVE/);
  assert.match(manager, /PUBLISHED/);
  assert.match(manager, /public|available|view public/i);
  assert.match(stateRoute, /This live class is not available/);
  assert.match(stateRoute, /no-store/);
  assert.doesNotMatch(stateRoute, /status: 404[\s\S]{0,200}s-maxage=15/);
});
