import { apiClient } from "@/lib/api-client";
import type { QuestionService } from "./question.service";
import type { Question } from "../types";

export const apiQuestionService: QuestionService = {
  async getAll() { return apiClient.get<Question[]>("/admin/questions"); },
  async answer(id, text) { return apiClient.post<Question>(`/admin/questions/${id}/answer`, { text }); },
};
