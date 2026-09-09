import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('student and admin app shell both stack on mobile and return to sidebar row at lg', () => {
  const source = read('src/components/layout/app-layout.tsx');

  assert.match(source, /flex min-h-dvh flex-col lg:flex-row/);
  assert.doesNotMatch(source, /isAdmin\s*\?\s*['"]flex-row['"]/);
  assert.match(source, /min-w-0 flex-1 overflow-x-hidden/);
});

test('student dashboard live session actions stack safely on narrow screens', () => {
  const source = read('src/app/(member)/dashboard/page.tsx');

  assert.match(source, /flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between/);
  assert.match(source, /w-full sm:w-auto/);
  assert.match(source, /break-words/);
});

test('course detail lesson and paid-live rows cannot force horizontal overflow', () => {
  const source = read('src/app/(member)/courses/[courseId]/page.tsx');

  assert.match(source, /min-w-0 flex-1/);
  assert.match(source, /break-words/);
  assert.match(source, /w-full sm:w-auto/);
});

test('student quiz choices and submit action are touch-friendly on phones', () => {
  const source = read('src/features/quizzes/components/student-quiz.tsx');

  assert.match(source, /items-start gap-3/);
  assert.match(source, /break-words/);
  assert.match(source, /w-full sm:w-auto/);
});

test('messages remains viewport-filling beneath the mobile student header', () => {
  const source = read('src/app/(member)/messages/page.tsx');

  assert.match(source, /h-\[calc\(100dvh-3\.5rem\)\]/);
  assert.match(source, /min-w-0/);
});
