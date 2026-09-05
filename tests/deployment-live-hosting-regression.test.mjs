import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateManagedHostingAmountDue,
} from "../src/features/hosting/domain/managed-hosting.ts";

const policy = {
  enabled: true,
  minimumMonthlyFeeUsd: 15,
  maximumMonthlyFeeUsd: 50,
};

test("monthly operator amount is a floor and usage can increase the amount due", () => {
  const below = calculateManagedHostingAmountDue({
    watchMinutes: 0,
    policy,
    monthlyMinimumFloorUsd: 27,
  });
  assert.equal(below.minimumFloorUsd, 27);
  assert.equal(below.usageDerivedFeeUsd, 0);
  assert.equal(below.amountDueUsd, 27);

  const above = calculateManagedHostingAmountDue({
    watchMinutes: 150_000,
    policy,
    monthlyMinimumFloorUsd: 27,
  });
  assert.equal(above.usageDerivedFeeUsd, 50);
  assert.equal(above.amountDueUsd, 50);

  const explicitHighFloor = calculateManagedHostingAmountDue({
    watchMinutes: 150_000,
    policy,
    monthlyMinimumFloorUsd: 65,
  });
  assert.equal(explicitHighFloor.amountDueUsd, 65);
});

test("Wrangler always creates the OpenNext bundle before upload or deploy", async () => {
  const source = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(source);
  assert.equal(config.main, ".open-next/worker.js");
  assert.equal(config.build?.command, "npm run cf:build");
});

test("mobile live room has one visual LIVE badge and a sticky player", async () => {
  const source = await readFile(
    new URL("../src/features/live-classes/components/live-class-room-mobile-first.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/bg-red-600/g) ?? []).length, 1);
  assert.match(source, /sticky top-0 z-30/);
  assert.match(source, /lg:static/);
});

test("hosting page explains migration setup instead of hard-crashing", async () => {
  const source = await readFile(
    new URL("../src/app/(admin)/admin/hosting/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /setupError/);
  assert.match(source, /MkLMS DB migrations GitHub Action/);
  assert.match(source, /Hosting setup is not complete/);
});
