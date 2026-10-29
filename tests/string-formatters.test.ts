import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRequestSubject,
  formatDenyReason,
  formatNoUiReason,
  formatRejectReason,
} from "../src/string-formatters.ts";
import type { PermissionRequest, PolicyResolution } from "../src/types.ts";

function request(overrides: Partial<PermissionRequest>): PermissionRequest {
  return {
    toolName: "write",
    input: {},
    body: "/project/file.txt",
    bodyKind: "path",
    cwd: "/project",
    ...overrides,
  };
}

const denyPolicy: PolicyResolution = { state: "deny", source: "default", chainedBash: false };

test("describes subjects by body kind", () => {
  assert.equal(describeRequestSubject(request({ bodyKind: "path" }), false), 'access to "/project/file.txt"');
  assert.equal(
    describeRequestSubject(request({ bodyKind: "command", body: "rm -rf /" }), false),
    'bash command "rm -rf /"',
  );
  assert.equal(
    describeRequestSubject(request({ bodyKind: "tool", toolName: "custom", body: "x" }), false),
    'tool "custom"',
  );
  assert.equal(
    describeRequestSubject(request({ bodyKind: "tool", toolName: "custom", body: "x" }), true),
    'tool "custom" with subject "x"',
  );
});

test("formats deny reasons with policy and chained-command note", () => {
  const reason = formatDenyReason(request({}), { ...denyPolicy, chainedBash: true });
  assert.match(reason, /^Permission denied for access to "\/project\/file\.txt"\./);
  assert.match(reason, /deny \(default\)/);
  assert.match(reason, /Shell chaining detected/);
  assert.match(reason, /Hard stop/);
});

test("formats no-UI and reject reasons", () => {
  assert.match(
    formatNoUiReason(request({ toolName: "edit" }), denyPolicy),
    /^The edit request requires approval, but no interactive UI is available\. Policy: deny \(default\)\.$/,
  );
  assert.match(formatRejectReason(request({})), /^User rejected access to "\/project\/file\.txt"\./);
});
