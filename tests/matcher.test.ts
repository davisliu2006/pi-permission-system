import assert from "node:assert/strict";
import test from "node:test";

import {
  findLastWildcardMatch,
  hasUnescapedWildcard,
  isMatchEverythingPattern,
  matchesWildcard,
} from "../src/matcher.ts";

test("wildcards match the entire command", () => {
  assert.equal(matchesWildcard("git status*", "git status --short"), true);
  assert.equal(matchesWildcard("git status*", "git status"), true);
  assert.equal(matchesWildcard("git status", "git status --short"), false);
  assert.equal(matchesWildcard("status", "git status"), false);
});

test("question mark matches exactly one character", () => {
  assert.equal(matchesWildcard("git ?", "git a"), true);
  assert.equal(matchesWildcard("git ?", "git ab"), false);
  assert.equal(matchesWildcard("git ?", "git "), false);
});

test("backslash escapes wildcard characters", () => {
  assert.equal(matchesWildcard("rm \\*", "rm *"), true);
  assert.equal(matchesWildcard("rm \\*", "rm build"), false);
  assert.equal(matchesWildcard("echo \\?", "echo ?"), true);
  assert.equal(matchesWildcard("echo \\?", "echo a"), false);
});

test("other regex metacharacters are literal", () => {
  assert.equal(matchesWildcard("a.b", "a.b"), true);
  assert.equal(matchesWildcard("a.b", "axb"), false);
  assert.equal(matchesWildcard("a+b", "a+b"), true);
  assert.equal(matchesWildcard("a+b", "aaab"), false);
});

test("last matching bash rule wins", () => {
  const rules = {
    "*": "ask" as const,
    "git *": "deny" as const,
    "git status*": "allow" as const,
    "git status --short": "deny" as const,
  };
  assert.deepEqual(findLastWildcardMatch(rules, "git status --short"), {
    pattern: "git status --short",
    state: "deny",
  });
  assert.deepEqual(findLastWildcardMatch(rules, "git status --long"), {
    pattern: "git status*",
    state: "allow",
  });
});

test("wildcard helpers distinguish escaped wildcards", () => {
  assert.equal(hasUnescapedWildcard("git *"), true);
  assert.equal(hasUnescapedWildcard("git \\*"), false);
  assert.equal(isMatchEverythingPattern("*"), true);
  assert.equal(isMatchEverythingPattern("**"), true);
  assert.equal(isMatchEverythingPattern("*?*"), true);
  assert.equal(isMatchEverythingPattern("\\*"), false);
  assert.equal(isMatchEverythingPattern("git *"), false);
});
