import { z } from "zod";

export const onboardingSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  bkash: z.string().min(1, "bKash/Nagad number is required"),
  telegram: z.string().min(1, "Telegram username is required"),
  bio: z.string().max(500).optional(),
});
