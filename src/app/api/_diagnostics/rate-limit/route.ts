import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export async function GET(request: Request) {
  const hostname = new URL(request.url).hostname;
  if (!hostname.endsWith(".workers.dev") || !hostname.includes("fix-rate-limit-runtime-diagnostics")) {
    return new Response(null, { status: 404 });
  }

  try {
    const context = getCloudflareContext();
    const env = context.env as unknown as { AUTH_RATE_LIMITER?: RateLimitBinding };
    const binding = env.AUTH_RATE_LIMITER;
    if (!binding) {
      return NextResponse.json({ contextAvailable: true, bindingPresent: false, limitFunctionPresent: false });
    }

    const result = await binding.limit({ key: "mklms-preview-direct-binding-probe" });
    return NextResponse.json({
      contextAvailable: true,
      bindingPresent: true,
      limitFunctionPresent: typeof binding.limit === "function",
      success: result.success,
    });
  } catch (error) {
    return NextResponse.json({
      contextAvailable: false,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}
