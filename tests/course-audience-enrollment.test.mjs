import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('migration 016 adds safe course assignment mode without exposing existing courses', () => {
  const path = new URL('../db/migrations/016_course_audience_assignment.sql', import.meta.url);
  assert.equal(existsSync(path), true);
  const migration = readFileSync(path, 'utf8');
  assert.match(migration, /assignment_mode/i);
  assert.match(migration, /SELECTED_STUDENTS/);
  assert.match(migration, /ALL_ACTIVE_STUDENTS/);
  assert.match(migration, /DEFAULT\s+'SELECTED_STUDENTS'/i);
  assert.doesNotMatch(migration, /ALTER TABLE\s+(live_batches|live_sessions)|DROP TABLE|DROP COLUMN/i);
});

test('future active students are enrolled into all-active courses by a database trigger', () => {
  const migration = read('db/migrations/016_course_audience_assignment.sql');
  assert.match(migration, /CREATE OR REPLACE FUNCTION mklms_enroll_active_student_in_all_courses/i);
  assert.match(migration, /AFTER INSERT OR UPDATE OF status ON students/i);
  assert.match(migration, /NEW\.status\s*=\s*'ACTIVE'/i);
  assert.match(migration, /INSERT INTO enrollments[\s\S]*SELECT[\s\S]*FROM courses c/i);
  assert.match(migration, /c\.assignment_mode\s*=\s*'ALL_ACTIVE_STUDENTS'/i);
  assert.match(migration, /ON CONFLICT \(student_id, course_id\)/i);
  assert.match(migration, /WHEN enrollments\.status = 'COMPLETED' THEN 'COMPLETED'/i);
});

test('admin course page exposes an audience manager for all-active or selected students', () => {
  const page = read('src/app/(admin)/admin/courses/[courseId]/page.tsx');
  const component = read('src/features/courses/components/admin/admin-course-audience-manager.tsx');
  assert.match(page, /AdminCourseAudienceManager/);
  assert.match(page, /listActiveStudents/);
  assert.match(component, /All active students/i);
  assert.match(component, /Selected students/i);
  assert.match(component, /future students/i);
  assert.doesNotMatch(page, /listStudents\(5000\)/);
});

test('admin audience repository bulk synchronizes active enrollments and preserves completed history', () => {
  const repo = read('src/features/courses/repositories/postgres-course-audience.repository.ts');
  assert.match(repo, /getCourseAudience/);
  assert.match(repo, /setCourseAudience/);
  assert.match(repo, /listActiveStudents/);
  assert.match(repo, /FROM students student[\s\S]*student\.status = 'ACTIVE'/i);
  assert.match(repo, /INSERT INTO enrollments[\s\S]*SELECT/i);
  assert.match(repo, /ON CONFLICT \(student_id, course_id\)/i);
  assert.match(repo, /WHEN enrollments\.status = 'COMPLETED' THEN 'COMPLETED'/i);
  assert.match(repo, /SET status = 'REVOKED'[\s\S]*status = 'ACTIVE'/i);
  assert.doesNotMatch(repo, /status = 'COMPLETED'[\s\S]*SET status = 'REVOKED'/i);
});

test('course audience API is admin-only, rate-limited, and validates assignment mode', () => {
  const route = read('src/app/api/admin/courses/[courseId]/audience/route.ts');
  assert.match(route, /hasValidAdminSession/);
  assert.match(route, /ADMIN_RATE_LIMITER/);
  assert.match(route, /SELECTED_STUDENTS/);
  assert.match(route, /ALL_ACTIVE_STUDENTS/);
  assert.match(route, /setCourseAudience/);
});

test('student learning remains published-course and enrollment gated', () => {
  const service = read('src/features/courses/services/student-learning.service.ts');
  assert.match(service, /getPublishedCourseStructure/);
  assert.match(service, /\["ACTIVE", "COMPLETED"\]\.includes\(enrollment\.status\)/);
  assert.doesNotMatch(service, /assignment_mode/);
});

test('student dashboard surfaces real published paid live sessions from enrolled courses', () => {
  const dashboard = read('src/app/(member)/dashboard/page.tsx');
  const repo = read('src/features/paid-live/repositories/postgres-paid-live.repository.ts');
  assert.match(repo, /listForStudent/);
  assert.match(repo, /JOIN enrollments enrollment/i);
  assert.match(repo, /enrollment\.status IN \('ACTIVE', 'COMPLETED'\)/i);
  assert.match(repo, /course\.status = 'PUBLISHED'/i);
  assert.match(repo, /live\.status = 'PUBLISHED'/i);
  assert.match(dashboard, /listForStudent/);
  assert.match(dashboard, /Member live sessions/);
  assert.match(dashboard, /courses\/\$\{liveSession\.courseId\}\/live\/\$\{liveSession\.id\}/);
  assert.doesNotMatch(dashboard, /will appear here only when a member live-session module is configured/i);
});

test('paid live join and playback still enforce course enrollment independently', () => {
  const join = read('src/app/api/courses/[courseId]/paid-live/[sessionId]/join/route.ts');
  const playback = read('src/app/api/courses/[courseId]/paid-live/[sessionId]/playback/route.ts');
  for (const route of [join, playback]) {
    assert.match(route, /getEnrollment/);
    assert.match(route, /\["ACTIVE", "COMPLETED"\]\.includes\(enrollment\.status\)/);
    assert.match(route, /courseStatus/);
    assert.match(route, /PUBLISHED/);
  }
});

test('course assignment feature does not couple public free live state or playback to paid courses', () => {
  const state = read('src/app/api/live/[slug]/state/route.ts');
  const playback = read('src/app/api/live/[slug]/playback/route.ts');
  assert.doesNotMatch(state, /assignment_mode|CourseAudience|ALL_ACTIVE_STUDENTS/);
  assert.doesNotMatch(playback, /assignment_mode|CourseAudience|ALL_ACTIVE_STUDENTS/);
});
