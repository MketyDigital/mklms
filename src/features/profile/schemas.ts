import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  bkash: z.string().optional(),
  telegram: z.string().optional(),
  bio: z.string().max(500).optional(),
});
