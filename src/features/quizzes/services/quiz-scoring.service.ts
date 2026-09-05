import type { QuizAttemptResult, QuizRecord } from "../domain/model";

export interface SubmittedQuizAnswer {
  questionId: string;
  choiceId: string;
}

export function scoreQuizAttempt(
  quiz: QuizRecord,
  submittedAnswers: SubmittedQuizAnswer[],
): Omit<QuizAttemptResult, "attemptId"> & {
  answers: Array<{ questionId: string; choiceId: string | null; correct: boolean }>;
} {
  const selected = new Map(submittedAnswers.map((answer) => [answer.questionId, answer.choiceId]));
  let correctAnswers = 0;

  const answers = quiz.questions.map((question) => {
    const choiceId = selected.get(question.id) ?? null;
    const choice = question.choices.find((candidate) => candidate.id === choiceId);
    const correct = Boolean(choice?.isCorrect);
    if (correct) correctAnswers += 1;
    return { questionId: question.id, choiceId, correct };
  });

  const totalQuestions = quiz.questions.length;
  const scorePercent = totalQuestions
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;

  return {
    scorePercent,
    passed: totalQuestions > 0 && scorePercent >= quiz.passMarkPercent,
    correctAnswers,
    totalQuestions,
    answers,
  };
}
