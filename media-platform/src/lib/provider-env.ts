import { getMediaEnv } from "./postgres";
import type { MediaProviderEnv } from "../config/providers";

export function getProviderEnv(): MediaProviderEnv {
  const env = getMediaEnv() as unknown as MediaProviderEnv;
  return {
    ...env,
    MEDIA_R2_ENABLED: String((env as any).MEDIA_R2_ENABLED ?? "true"),
  };
}
