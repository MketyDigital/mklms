export type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface QuizChoiceRecord {
  id: string;
  questionId: string;
  label: string;
  isCorrect?: boolean;
  position: number;
}

export interface QuizQuestionRecord {
  id: string;
  quizId: string;
  prompt: string;
  position: number;
  choices: QuizChoiceRecord[];
}

export interface QuizRecord {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string | null;
  passMarkPercent: number;
  status: QuizStatus;
  position: number;
  questions: QuizQuestionRecord[];
}

export interface QuizAttemptResult {
  attemptId: string;
  scorePercent: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
}
