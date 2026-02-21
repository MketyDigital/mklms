import type { QuestionService } from "./services/question.service";
import { mockQuestionService } from "./services/question.mock";
import { apiQuestionService } from "./services/question.api";

export const questionService: QuestionService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockQuestionService
    : apiQuestionService;

export * from "./types";
export * from "./schemas";
export type { QuestionService } from "./services/question.service";
