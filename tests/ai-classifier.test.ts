import assert from "node:assert/strict";
import test from "node:test";

import { classifyAutoPermission } from "../src/ai-classifier.ts";
import type { PermissionRequest } from "../src/types.ts";

test("stub classifier always returns ask", async () => {
  const request: PermissionRequest = {
    toolName: "bash",
    input: { command: "git status" },
    body: "git status",
    bodyKind: "command",
    cwd: "/project",
  };
  assert.equal(await classifyAutoPermission(request), "ask");
});
