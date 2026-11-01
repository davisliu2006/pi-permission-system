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

function bashRequest(command: string, isChainedBash = false): PermissionRequest {
  return {
    toolName: "bash",
    input: { command },
    body: command,
    bodyKind: "command",
    cwd: "/project",
    isChainedBash,
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

test("list sequences match each segment with worst state winning", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "ask" },
    bash: {
      "git status*": "allow",
      "git log*": "allow",
      "rm *": "deny",
    },
  };

  const allowed = resolvePolicy(config, bashRequest("git status; git log"));
  assert.equal(allowed.state, "allow");
  assert.equal(allowed.source, "bash");
  assert.equal(allowed.isChainedBash, false);

  const andAllowed = resolvePolicy(config, bashRequest("git status && git log"));
  assert.equal(andAllowed.state, "allow");
  assert.equal(andAllowed.isChainedBash, false);

  const orDenied = resolvePolicy(config, bashRequest("git status || rm -rf /"));
  assert.equal(orDenied.state, "deny");
  assert.equal(orDenied.source, "bash");
  assert.equal(orDenied.matchedPattern, "rm *");
  assert.equal(orDenied.isChainedBash, false);

  const denied = resolvePolicy(config, bashRequest("git status; rm -rf /"));
  assert.equal(denied.state, "deny");
  assert.equal(denied.source, "bash");
  assert.equal(denied.matchedPattern, "rm *");
  assert.equal(denied.isChainedBash, false);
});

test("newline sequences are matched like other list sequences", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    bash: {
      "git status*": "allow",
      "git log*": "ask",
    },
  };

  const policy = resolvePolicy(config, bashRequest("git status\ngit log"));
  assert.equal(policy.state, "ask");
  assert.equal(policy.source, "bash");
  assert.equal(policy.matchedPattern, "git log*");
});

test("complex chained commands skip bash patterns and fall back to tools.bash", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "ask" },
    bash: {
      "*": "allow",
      "git status*": "allow",
    },
  };

  const policy = resolvePolicy(config, bashRequest("git status | sh"));
  assert.equal(policy.state, "ask");
  assert.equal(policy.source, "tool");
  assert.equal(policy.isChainedBash, true);
});

test("complex chained commands fall back to default when tools.bash is absent", () => {
  const config: PermissionConfig = {
    default: "deny",
    tools: {},
    bash: { "*": "allow" },
    external_directory: {},
  };

  const policy = resolvePolicy(config, bashRequest("git status | sh"));
  assert.equal(policy.state, "deny");
  assert.equal(policy.source, "default");
  assert.equal(policy.isChainedBash, true);
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
    isExternalDirectory: true,
  };

  const policy = resolvePolicy(config, request);
  assert.equal(policy.state, "allow");
  assert.equal(policy.source, "external");
});

test("session wildcard approvals do not apply to complex chained commands", () => {
  const rules: AllowAlwaysRule[] = [
    { tool: "bash", kind: "wildcard", body: "git status*" },
  ];

  assert.equal(
    findSessionApproval(rules, bashRequest("git status --short"), false)?.kind,
    "wildcard"
  );
  assert.equal(
    findSessionApproval(rules, bashRequest("git status | sh"), true),
    undefined
  );
});

test("session exact approvals apply to complex chained commands", () => {
  const command = "git status | sh";
  const rules: AllowAlwaysRule[] = [
    { tool: "bash", kind: "exact", body: command },
  ];

  assert.equal(findSessionApproval(rules, bashRequest(command), true)?.kind, "exact");
});

test("session approvals require every list segment to match", () => {
  const statusOnly: AllowAlwaysRule[] = [
    { tool: "bash", kind: "wildcard", body: "git status*" },
  ];
  const statusAndLog: AllowAlwaysRule[] = [
    { tool: "bash", kind: "wildcard", body: "git status*" },
    { tool: "bash", kind: "wildcard", body: "git log*" },
  ];

  assert.equal(
    findSessionApproval(statusOnly, bashRequest("git status && git log"), false),
    undefined
  );
  assert.equal(
    findSessionApproval(statusAndLog, bashRequest("git status && git log"), false)?.kind,
    "wildcard"
  );
  assert.equal(
    findSessionApproval(statusAndLog, bashRequest("git status; git log"), false)?.kind,
    "wildcard"
  );
});

test("session exact full-command approvals still cover list sequences", () => {
  const command = "git status && git log";
  const rules: AllowAlwaysRule[] = [
    { tool: "bash", kind: "exact", body: command },
  ];

  assert.equal(findSessionApproval(rules, bashRequest(command), false)?.kind, "exact");
});

test("session exact path approvals match by tool and body only", () => {
  const request: PermissionRequest = {
    toolName: "write",
    input: {},
    body: "/outside/file.txt",
    bodyKind: "path",
    cwd: "/project",
    isExternalDirectory: true,
  };

  const rules: AllowAlwaysRule[] = [
    { tool: "write", kind: "exact", body: "/outside/file.txt" },
  ];

  assert.equal(findSessionApproval(rules, request, false)?.kind, "exact");
  assert.equal(
    findSessionApproval(
      rules,
      { ...request, isExternalDirectory: false },
      false
    )?.kind,
    "exact"
  );
});