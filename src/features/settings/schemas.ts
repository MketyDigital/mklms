import { z } from "zod";

export const updateSettingsSchema = z.object({
  sessionDate: z.string().optional(),
  sessionLink: z.string().url().optional().or(z.literal("")),
  sessionTitle: z.string().max(200).optional(),
  announcement: z.string().max(1000).optional(),
});
