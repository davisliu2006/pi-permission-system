import assert from "node:assert/strict";
import test from "node:test";

import { parseAutoDecision } from "../src/ai-classifier.ts";

test("parseAutoDecision only accepts an exact allow token", () => {
  assert.equal(parseAutoDecision("allow"), "allow");
  assert.equal(parseAutoDecision("  \"ALLOW\".  "), "allow");
  assert.equal(parseAutoDecision("allow\nextra"), "ask");
  assert.equal(parseAutoDecision("ask"), "ask");
  assert.equal(parseAutoDecision(undefined), "ask");
  assert.equal(parseAutoDecision(""), "ask");
});
