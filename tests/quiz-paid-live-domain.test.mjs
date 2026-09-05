import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreQuizAttempt } from '../src/features/quizzes/services/quiz-scoring.service.ts';
import { resolvePaidLiveState } from '../src/features/paid-live/services/paid-live-state.service.ts';

test('quiz scoring derives correctness only from the server quiz answer key', () => {
  const quiz = {
    id: 'quiz-1', moduleId: 'module-1', courseId: 'course-1', title: 'Risk',
    description: null, passMarkPercent: 70, status: 'PUBLISHED', position: 1,
    questions: [
      {
        id: 'q1', quizId: 'quiz-1', prompt: 'Risk?', position: 1,
        choices: [
          { id: 'q1-a', questionId: 'q1', label: '1%', isCorrect: true, position: 1 },
          { id: 'q1-b', questionId: 'q1', label: '100%', isCorrect: false, position: 2 },
        ],
      },
      {
        id: 'q2', quizId: 'quiz-1', prompt: 'Stop loss?', position: 2,
        choices: [
          { id: 'q2-a', questionId: 'q2', label: 'Ignore it', isCorrect: false, position: 1 },
          { id: 'q2-b', questionId: 'q2', label: 'Use it', isCorrect: true, position: 2 },
        ],
      },
    ],
  };

  const perfect = scoreQuizAttempt(quiz, [
    { questionId: 'q1', choiceId: 'q1-a' },
    { questionId: 'q2', choiceId: 'q2-b' },
  ]);
  assert.equal(perfect.scorePercent, 100);
  assert.equal(perfect.passed, true);

  const failed = scoreQuizAttempt(quiz, [
    { questionId: 'q1', choiceId: 'q1-b' },
    { questionId: 'q2', choiceId: 'q2-b' },
  ]);
  assert.equal(failed.scorePercent, 50);
  assert.equal(failed.passed, false);
});

test('paid live state is time-window driven and separate from public webinar state', () => {
  const startsAt = new Date('2026-09-05T18:00:00Z');
  const endsAt = new Date('2026-09-05T20:00:00Z');
  assert.equal(resolvePaidLiveState({ startsAt, endsAt, now: new Date('2026-09-05T17:59:59Z') }), 'UPCOMING');
  assert.equal(resolvePaidLiveState({ startsAt, endsAt, now: new Date('2026-09-05T18:00:00Z') }), 'LIVE');
  assert.equal(resolvePaidLiveState({ startsAt, endsAt, now: new Date('2026-09-05T20:00:00Z') }), 'ENDED');
});
