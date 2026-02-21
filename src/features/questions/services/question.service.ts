import type { Question } from "../types";

export interface QuestionService {
  getAll(): Promise<Question[]>;
  answer(id: string, text: string): Promise<Question>;
}
