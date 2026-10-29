import assert from "node:assert/strict";
import test from "node:test";

import { validateWildcardSuggestion } from "../src/wildcard-validation.ts";

test("accepts wildcard patterns that match the command", () => {
  assert.deepEqual(validateWildcardSuggestion("git status*", "git status --short"), {
    valid: true,
    broad: false,
  });
});

test("rejects non-matching patterns", () => {
  const result = validateWildcardSuggestion("npm *", "git status --short");
  assert.equal(result.valid, false);
});

test("marks match-everything patterns as broad", () => {
  assert.deepEqual(validateWildcardSuggestion("*", "git status --short"), {
    valid: true,
    broad: true,
  });
  assert.deepEqual(validateWildcardSuggestion("**", "git status --short"), {
    valid: true,
    broad: true,
  });
});

test("does not mark escaped wildcard literals as broad", () => {
  const result = validateWildcardSuggestion("\\*", "*");
  assert.deepEqual(result, { valid: true, broad: false });
});
