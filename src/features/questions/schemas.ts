import { z } from "zod";

export const askQuestionSchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(2000),
});

export const answerQuestionSchema = z.object({
  text: z.string().min(1, "Answer cannot be empty").max(5000),
});
