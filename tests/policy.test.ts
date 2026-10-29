import assert from "node:assert/strict";
import test from "node:test";

import {
  findSessionApproval,
  resolvePolicy,
} from "../src/policy.ts";
import type {
  PermissionConfig,
  PermissionRequest,
  AllowAlwaysRule,
} from "../src/types.ts";

const baseConfig: PermissionConfig = {
  default: "ask",
  tools: { bash: "ask", read: "ask", write: "ask" },
  bash: {},
  external_directory: {},
};

function bashRequest(command: string): PermissionRequest {
  return {
    toolName: "bash",
    input: { command },
    body: command,
    bodyKind: "command",
    cwd: "/project",
    chainedBash: false,
  };
}

test("bash last match overrides tool-level deny for simple commands", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "deny" },
    bash: {
      "*": "ask",
      "git status*": "allow",
    },
  };

  const policy = resolvePolicy(config, bashRequest("git status --short"));
  assert.equal(policy.state, "allow");
  assert.equal(policy.source, "bash");
  assert.equal(policy.matchedPattern, "git status*");
});

test("chained commands skip bash patterns and fall back to tools.bash", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "ask" },
    bash: {
      "*": "allow",
      "git status*": "allow",
    },
  };

  const request = bashRequest("git status; rm -rf /");
  const policy = resolvePolicy(config, request);
  assert.equal(policy.state, "ask");
  assert.equal(policy.source, "tool");
  assert.equal(policy.chainedBash, true);
});

test("chained commands fall back to default when tools.bash is absent", () => {
  const config: PermissionConfig = {
    default: "deny",
    tools: {},
    bash: { "*": "allow" },
    external_directory: {},
  };

  const policy = resolvePolicy(config, bashRequest("git status && rm -rf /"));
  assert.equal(policy.state, "deny");
  assert.equal(policy.source, "default");
});

test("external directory rules replace the normal tool policy", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, write: "deny" },
    external_directory: { write: "allow" },
  };

  const request: PermissionRequest = {
    toolName: "write",
    input: {},
    body: "/outside/file.txt",
    bodyKind: "path",
    cwd: "/project",
    externalDirectoryPath: "/outside/file.txt",
  };

  const policy = resolvePolicy(config, request);
  assert.equal(policy.state, "allow");
  assert.equal(policy.source, "external");
});

test("session wildcard approvals do not apply to chained commands", () => {
  const rules: AllowAlwaysRule[] = [
    { scope: "tool", tool: "bash", kind: "wildcard", pattern: "git status*" },
  ];

  assert.equal(
    findSessionApproval(rules, bashRequest("git status --short"), false)?.kind,
    "wildcard",
  );
  assert.equal(
    findSessionApproval(rules, bashRequest("git status; rm -rf /"), true),
    undefined,
  );
});

test("session exact approvals apply to chained commands", () => {
  const command = "git status; rm -rf /";
  const rules: AllowAlwaysRule[] = [
    { scope: "tool", tool: "bash", kind: "exact", body: command },
  ];

  assert.equal(findSessionApproval(rules, bashRequest(command), true)?.kind, "exact");
});

test("external session approvals are scoped separately", () => {
  const request: PermissionRequest = {
    toolName: "write",
    input: {},
    body: "/outside/file.txt",
    bodyKind: "path",
    cwd: "/project",
    externalDirectoryPath: "/outside/file.txt",
  };

  const toolRule: AllowAlwaysRule[] = [
    { scope: "tool", tool: "write", kind: "exact", body: "/outside/file.txt" },
  ];
  const externalRule: AllowAlwaysRule[] = [
    {
      scope: "external_directory",
      tool: "write",
      kind: "exact",
      body: "/outside/file.txt",
    },
  ];

  assert.equal(findSessionApproval(toolRule, request, false), undefined);
  assert.equal(findSessionApproval(externalRule, request, false)?.scope, "external_directory");
});
