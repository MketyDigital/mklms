import { z } from "zod";

const envSchema = z.object({
  USE_MOCKS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
});

function parseEnv() {
  const parsed = envSchema.safeParse({
    USE_MOCKS: process.env.USE_MOCKS,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = parseEnv();
