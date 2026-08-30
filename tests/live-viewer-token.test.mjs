import assert from "node:assert/strict";
import test from "node:test";

import {
  generateLiveViewerToken,
  hashLiveViewerToken,
  isValidLiveViewerToken,
} from "../src/features/live-classes/domain/viewer-token.ts";

test("live viewer tokens are random, valid, and hashable", () => {
  const first = generateLiveViewerToken();
  const second = generateLiveViewerToken();

  assert.notEqual(first, second);
  assert.equal(isValidLiveViewerToken(first), true);
  assert.equal(isValidLiveViewerToken(second), true);
  assert.match(hashLiveViewerToken(first), /^[a-f0-9]{64}$/);
});

test("live viewer token validation rejects empty, short, and malformed values", () => {
  assert.equal(isValidLiveViewerToken(""), false);
  assert.equal(isValidLiveViewerToken("short"), false);
  assert.equal(isValidLiveViewerToken("not valid because spaces are forbidden"), false);
  assert.equal(isValidLiveViewerToken("a".repeat(300)), false);
});
