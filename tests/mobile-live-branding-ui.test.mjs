import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("mobile live room keeps the player visible while chat owns keyboard-era scrolling", async () => {
  const rootLayout = await source("src/app/layout.tsx");
  const livePage = await source("src/app/(public)/live/[slug]/page.tsx");
  const globals = await source("src/app/globals.css");
  const liveRoom = await source("src/features/live-classes/components/live-class-room-mobile-first.tsx");

  assert.match(rootLayout, /interactiveWidget:\s*"resizes-content"/, "mobile keyboard must resize the visual viewport");
  assert.match(livePage, /data-live-mobile-viewport/, "public live page must opt into the contained mobile shell");
  assert.match(globals, /\[data-live-mobile-viewport\][\s\S]*height:\s*100dvh/, "mobile live shell must be visual-viewport contained");
  assert.match(globals, /\.grid[\s\S]*min-height:\s*0[\s\S]*flex:\s*1 1 0%/, "live content must shrink beneath the player");
  assert.match(globals, /aside[\s\S]*min-height:\s*0[\s\S]*flex:\s*1 1 0%/, "chat panel must consume only remaining mobile height");
  assert.match(liveRoom, /overflow-y-auto/, "chat messages must continue scrolling inside the chat panel");
});

test("configured organization branding drives metadata, favicon, home, auth and app chrome", async () => {
  const rootLayout = await source("src/app/layout.tsx");
  const home = await source("src/app/(public)/page.tsx");
  const login = await source("src/app/(auth)/login/page.tsx");
  const adminLogin = await source("src/app/(auth)/admin-login/page.tsx");
  const onboarding = await source("src/app/(auth)/onboarding/page.tsx");
  const sidebar = await source("src/components/layout/app-sidebar.tsx");

  assert.match(rootLayout, /generateMetadata/);
  assert.match(rootLayout, /faviconUrl/);
  assert.match(rootLayout, /organizationName/);
  assert.match(rootLayout, /BrandingProvider/);

  assert.match(home, /BrandMark/);
  assert.doesNotMatch(home, />MkLMS</);
  assert.doesNotMatch(home, /MkLMS student access code/);

  assert.match(login, /BrandMark/);
  assert.doesNotMatch(login, />MkLMS</);
  assert.match(adminLogin, /BrandMark/);
  assert.match(onboarding, /BrandMark/);

  assert.match(sidebar, /usePlatformBranding/);
  assert.match(sidebar, /logoUrl/);
  assert.match(sidebar, /organizationName/);
  assert.doesNotMatch(sidebar, />MkLMS</);
});
