import assert from "node:assert/strict";
import test from "node:test";

import {
  splitWildcardList,
  validateWildcardSuggestion,
  validateWildcardSuggestions,
} from "../src/wildcard-validation.ts";

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

test("splitWildcardList trims semicolon-separated patterns", () => {
  assert.deepEqual(splitWildcardList(" git status* ; git log* "), [
    "git status*",
    "git log*",
  ]);
});

test("validateWildcardSuggestions accepts aligned pattern lists", () => {
  assert.deepEqual(
    validateWildcardSuggestions("git status*; git log*", [
      "git status --short",
      "git log -1",
    ]),
    {
      valid: true,
      patterns: ["git status*", "git log*"],
      broadPatterns: [],
    }
  );
});

test("validateWildcardSuggestions rejects count mismatches", () => {
  const result = validateWildcardSuggestions("git status*", [
    "git status --short",
    "git log -1",
  ]);
  assert.equal(result.valid, false);
});

test("validateWildcardSuggestions reports broad patterns", () => {
  assert.deepEqual(
    validateWildcardSuggestions("*; git log*", ["git status --short", "git log -1"]),
    {
      valid: true,
      patterns: ["*", "git log*"],
      broadPatterns: ["*"],
    }
  );
});