import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
});

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  status: z.enum(["published", "draft", "in_progress"]).optional(),
});

export const createVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  youtubeUrl: z.string().url("Must be a valid URL"),
  description: z.string().max(5000).optional(),
  resources: z.string().optional(),
});
