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
});

test('admin course page exposes an audience manager for all-active or selected students', () => {
  const page = read('src/app/(admin)/admin/courses/[courseId]/page.tsx');
  const component = read('src/features/courses/components/admin/admin-course-audience-manager.tsx');
  assert.match(page, /AdminCourseAudienceManager/);
  assert.match(component, /All active students/i);
  assert.match(component, /Selected students/i);
  assert.match(component, /future/i);
});

test('admin audience repository synchronizes current active enrollments safely', () => {
  const repo = read('src/features/courses/repositories/postgres-admin-learning.repository.ts');
  assert.match(repo, /getCourseAudience/);
  assert.match(repo, /setCourseAudience/);
  assert.match(repo, /ALL_ACTIVE_STUDENTS/);
  assert.match(repo, /FROM students[\s\S]*status\s*=\s*'ACTIVE'/i);
  assert.match(repo, /ON CONFLICT \(student_id, course_id\)/i);
  assert.match(repo, /status\s*=\s*'REVOKED'/i);
  assert.match(repo, /status\s*=\s*'ACTIVE'/i);
  assert.match(repo, /status\s*<>\s*'COMPLETED'|status\s*=\s*'ACTIVE'/i);
});

test('verified claim auto-enrolls a newly active student into all-active courses', () => {
  const repo = read('src/features/access/repositories/postgres-access.repository.ts');
  assert.match(repo, /assignment_mode\s*=\s*'ALL_ACTIVE_STUDENTS'/i);
  assert.match(repo, /INSERT INTO enrollments[\s\S]*SELECT[\s\S]*FROM courses/i);
  assert.match(repo, /ON CONFLICT \(student_id, course_id\)/i);
});

test('student dashboard surfaces real published paid live sessions from enrolled courses', () => {
  const dashboard = read('src/app/(member)/dashboard/page.tsx');
  const repo = read('src/features/paid-live/repositories/postgres-paid-live.repository.ts');
  assert.match(repo, /listForStudent/);
  assert.match(repo, /JOIN enrollments/i);
  assert.match(repo, /status IN \('ACTIVE', 'COMPLETED'\)/i);
  assert.match(repo, /paid_course_live_sessions/i);
  assert.match(dashboard, /listForStudent/);
  assert.match(dashboard, /Member live sessions/);
  assert.match(dashboard, /courses\/\$\{.*courseId.*\}\/live\//s);
  assert.doesNotMatch(dashboard, /will appear here only when a member live-session module is configured/i);
});

test('course assignment feature does not couple public free live state or playback to paid courses', () => {
  const state = read('src/app/api/live/[slug]/state/route.ts');
  const playback = read('src/app/api/live/[slug]/playback/route.ts');
  assert.doesNotMatch(state, /assignment_mode|CourseAudience|ALL_ACTIVE_STUDENTS/);
  assert.doesNotMatch(playback, /assignment_mode|CourseAudience|ALL_ACTIVE_STUDENTS/);
});
