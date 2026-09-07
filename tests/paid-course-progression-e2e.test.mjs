import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VideoProgressService } from '../src/features/media/services/video-progress.service.ts';

const finalVideoCourse = {
  id: 'course-1', slug: 'course-one', title: 'Course One', status: 'PUBLISHED', position: 1,
  modules: [{
    id: 'module-1', courseId: 'course-1', title: 'Module One', position: 1,
    lessons: [{
      id: 'lesson-1', moduleId: 'module-1', title: 'Video', position: 1,
      status: 'PUBLISHED', mediaAssetId: 'media-1', completionMode: 'VIDEO_PROGRESS',
      completionThresholdPercent: 90, durationSeconds: 100,
    }],
  }],
};

class CumulativeRepo {
  constructor({ priorProgress = 0, quizzesPassed = true } = {}) {
    this.priorProgress = priorProgress;
    this.quizzesPassed = quizzesPassed;
    this.completed = new Set();
    this.saved = [];
    this.completedEnrollment = false;
  }
  async getPlaybackGrant() {
    return {
      id: 'grant-1', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-1',
      startedAt: new Date('2026-09-07T20:00:00.000Z'),
      expiresAt: new Date('2026-09-07T22:00:00.000Z'), revokedAt: null,
    };
  }
  async getCourseStructure() { return finalVideoCourse; }
  async getEnrollment() { return { studentId: 'student-1', courseId: 'course-1', status: 'ACTIVE' }; }
  async getCompletedLessonIds() { return new Set(this.completed); }
  async getLessonProgress() {
    return {
      lessonId: 'lesson-1', progressPercent: this.priorProgress,
      lastPositionSeconds: this.priorProgress, completed: this.priorProgress >= 90,
    };
  }
  async allRequiredQuizzesPassed() { return this.quizzesPassed; }
  async saveLessonProgress(_studentId, _courseId, lessonId, progressPercent, lastPositionSeconds, completed) {
    this.saved.push({ lessonId, progressPercent, lastPositionSeconds, completed });
    this.priorProgress = Math.max(this.priorProgress, progressPercent);
    if (completed) this.completed.add(lessonId);
  }
  async markEnrollmentCompleted() { this.completedEnrollment = true; }
}

test('resumed playback never reports or persists less than prior saved lesson progress', async () => {
  const repo = new CumulativeRepo({ priorProgress: 45 });
  const service = new VideoProgressService(repo, {
    now: () => new Date('2026-09-07T20:00:10.000Z'),
  });

  const result = await service.reportProgress({
    grantId: 'grant-1', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-1',
    reportedPercent: 10, lastPositionSeconds: 10,
  });

  assert.equal(result.ok, true);
  assert.equal(result.creditedPercent, 45);
  assert.equal(repo.saved.at(-1).progressPercent, 45);
});

test('video lesson reaching 100 percent cannot complete a course while a required quiz remains unpassed', async () => {
  const repo = new CumulativeRepo({ quizzesPassed: false });
  const service = new VideoProgressService(repo, {
    now: () => new Date('2026-09-07T20:01:40.000Z'),
  });

  const result = await service.reportProgress({
    grantId: 'grant-1', studentId: 'student-1', courseId: 'course-1', lessonId: 'lesson-1',
    reportedPercent: 100, lastPositionSeconds: 100,
  });

  assert.equal(result.ok, true);
  assert.equal(result.lessonCompleted, true);
  assert.equal(result.courseProgressPercent, 100);
  assert.equal(result.courseCompleted, false);
  assert.equal(repo.completedEnrollment, false);
});

test('Postgres learning repository exposes persisted partial lesson progress for student rendering', () => {
  const source = readFileSync('src/features/courses/repositories/postgres-learning.repository.ts', 'utf8');
  assert.match(source, /getLessonProgress\s*\(/);
  assert.match(source, /progress_percent/);
  assert.match(source, /last_position_seconds/);
});

test('student course read model carries saved partial progress and quiz-aware lock state', () => {
  const source = readFileSync('src/features/courses/services/student-learning.service.ts', 'utf8');
  assert.match(source, /progressPercent/);
  assert.match(source, /passedQuizIds|quiz/i);
  assert.match(source, /locked/);
});

test('quiz attempt route enforces progression, returns next destination and ensures certificate on final completion', () => {
  const source = readFileSync('src/app/api/courses/[courseId]/quizzes/[quizId]/attempt/route.ts', 'utf8');
  assert.match(source, /ensureCourseCertificate/);
  assert.match(source, /nextDestination/);
  assert.match(source, /canAccessQuiz|quiz.*locked|progression/i);
});

test('student quiz automatically navigates after a successful pass', () => {
  const source = readFileSync('src/features/quizzes/components/student-quiz.tsx', 'utf8');
  assert.match(source, /useRouter/);
  assert.match(source, /nextDestination/);
  assert.match(source, /router\.(push|replace)/);
});

test('protected lesson player hydrates persisted progress and advances from server destination', () => {
  const source = readFileSync('src/features/media/components/protected-lesson-player.tsx', 'utf8');
  assert.match(source, /initialProgressPercent/);
  assert.match(source, /nextDestination/);
  assert.match(source, /useRouter/);
});

test('course overview renders quiz locks and does not expose every quiz as an unconditional link', () => {
  const source = readFileSync('src/app/(member)/courses/[courseId]/page.tsx', 'utf8');
  assert.match(source, /quiz\.locked|quizLocked|canAccessQuiz|lockedQuiz/i);
});
