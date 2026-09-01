import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("mobile live room keeps the player visible while chat owns keyboard-era scrolling", async () => {
  const liveRoom = await source("src/features/live-classes/components/live-class-room-mobile-first.tsx");

  assert.match(liveRoom, /h-dvh[^\"]*overflow-hidden/, "LIVE mobile shell must be visual-viewport contained");
  assert.match(liveRoom, /flex-1[^\"]*min-h-0|min-h-0[^\"]*flex-1/, "LIVE content must be allowed to shrink below the pinned player");
  assert.match(liveRoom, /overflow-y-auto/, "chat messages must scroll inside the chat panel");
  assert.doesNotMatch(liveRoom, /min-h-\[60dvh\]/, "mobile chat must not force a document-height scroll that can push the player away");
});

test("configured organization branding drives metadata, favicon, home, auth and app chrome", async () => {
  const rootLayout = await source("src/app/layout.tsx");
  const home = await source("src/app/(public)/page.tsx");
  const login = await source("src/app/(auth)/login/page.tsx");
  const onboarding = await source("src/app/(auth)/onboarding/page.tsx");
  const sidebar = await source("src/components/layout/app-sidebar.tsx");
  const livePage = await source("src/app/(public)/live/[slug]/page.tsx");

  assert.match(rootLayout, /generateMetadata/);
  assert.match(rootLayout, /faviconUrl/);
  assert.match(rootLayout, /organizationName/);
  assert.match(rootLayout, /BrandingProvider/);

  assert.match(home, /BrandMark/);
  assert.doesNotMatch(home, />MkLMS</);
  assert.doesNotMatch(home, /MkLMS student access code/);

  assert.match(login, /BrandMark/);
  assert.doesNotMatch(login, />MkLMS</);
  assert.match(onboarding, /BrandMark/);

  assert.match(sidebar, /usePlatformBranding/);
  assert.match(sidebar, /logoUrl/);
  assert.match(sidebar, /organizationName/);
  assert.doesNotMatch(sidebar, />MkLMS</);

  assert.match(livePage, /logoUrl={settings\.logoUrl/);
});
