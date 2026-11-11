import assert from "node:assert/strict";
import test from "node:test";

import {
  findSessionApproval,
  resolveAllowAlwaysMode,
  resolvePolicy,
} from "../src/policy.ts";
import { analyzeShellCommand } from "../src/shell.ts";
import type {
  PermissionConfig,
  PermissionRequest,
  PolicyResolution,
  AllowAlwaysRule,
} from "../src/types.ts";

const baseConfig: PermissionConfig = {
  default: "ask",
  tools: { bash: "ask", read: "ask", write: "ask" },
  bash: {},
  external_directory: {},
  settings: {},
};

function bashRequest(command: string): PermissionRequest {
  return {
    toolName: "bash",
    input: { command },
    body: command,
    bodyKind: "command",
    cwd: "/project",
    bashAnalysis: analyzeShellCommand(command),
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

  const andAllowed = resolvePolicy(config, bashRequest("git status && git log"));
  assert.equal(andAllowed.state, "allow");

  const orDenied = resolvePolicy(config, bashRequest("git status || rm -rf /"));
  assert.equal(orDenied.state, "deny");
  assert.equal(orDenied.source, "bash");
  assert.equal(orDenied.matchedPattern, "rm *");

  const denied = resolvePolicy(config, bashRequest("git status; rm -rf /"));
  assert.equal(denied.state, "deny");
  assert.equal(denied.source, "bash");
  assert.equal(denied.matchedPattern, "rm *");
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

test("complex chained commands skip allow bash patterns and fall back to tools.bash", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "ask" },
    bash: {
      "*": "allow",
      "git status*": "allow",
    },
  };

  const request = bashRequest("git status | sh");
  const policy = resolvePolicy(config, request);
  assert.equal(policy.state, "ask");
  assert.equal(policy.source, "tool");
  assert.equal(request.bashAnalysis?.isComplex, true);
  assert.deepEqual(request.bashAnalysis?.segments, ["git status", "sh"]);
});

test("complex chained commands fall back to default when tools.bash is absent", () => {
  const config: PermissionConfig = {
    default: "deny",
    tools: {},
    bash: { "*": "allow" },
    external_directory: {},
    settings: {},
  };

  const request = bashRequest("git status | sh");
  const policy = resolvePolicy(config, request);
  assert.equal(policy.state, "deny");
  assert.equal(policy.source, "default");
  assert.equal(request.bashAnalysis?.isComplex, true);
});

test("complex pipelines still honor bash deny rules", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "allow" },
    bash: {
      "*": "allow",
      "rm *": "deny",
      "sh*": "deny",
    },
  };

  const piped = resolvePolicy(config, bashRequest("git status | sh"));
  assert.equal(piped.state, "deny");
  assert.equal(piped.source, "bash");
  assert.equal(piped.matchedPattern, "sh*");

  const stderrPipe = resolvePolicy(config, bashRequest("git status |& sh -c rm"));
  assert.equal(stderrPipe.state, "deny");
  assert.equal(stderrPipe.source, "bash");

  const deniedStage = resolvePolicy(
    config,
    bashRequest("echo hi | rm -rf /")
  );
  assert.equal(deniedStage.state, "deny");
  assert.equal(deniedStage.source, "bash");
  assert.equal(deniedStage.matchedPattern, "rm *");
});

test("complex pipelines honor ask and auto bash rules", () => {
  const askConfig: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "allow" },
    bash: {
      "*": "allow",
      "sh*": "ask",
    },
  };
  const askPolicy = resolvePolicy(askConfig, bashRequest("git status | sh"));
  assert.equal(askPolicy.state, "ask");
  assert.equal(askPolicy.source, "bash");
  assert.equal(askPolicy.matchedPattern, "sh*");

  const autoConfig: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "allow" },
    bash: {
      "*": "allow",
      "sh*": "auto",
    },
  };
  const autoPolicy = resolvePolicy(autoConfig, bashRequest("git status | sh"));
  assert.equal(autoPolicy.state, "auto");
  assert.equal(autoPolicy.source, "bash");
  assert.equal(autoPolicy.matchedPattern, "sh*");
});

test("multi-segment bash prefers deny over ask over auto over allow", () => {
  const config: PermissionConfig = {
    ...baseConfig,
    tools: { ...baseConfig.tools, bash: "allow" },
    bash: {
      "git status*": "allow",
      "git log*": "auto",
      "git diff*": "ask",
      "rm *": "deny",
    },
  };

  assert.equal(
    resolvePolicy(config, bashRequest("git status; git log")).state,
    "auto"
  );
  assert.equal(
    resolvePolicy(config, bashRequest("git status; git log; git diff")).state,
    "ask"
  );
  assert.equal(
    resolvePolicy(config, bashRequest("git status; git log; rm -rf /")).state,
    "deny"
  );
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
    findSessionApproval(rules, bashRequest("git status --short"))?.kind,
    "wildcard"
  );
  assert.equal(
    findSessionApproval(rules, bashRequest("git status | sh")),
    undefined
  );
});

test("session exact approvals apply to complex chained commands", () => {
  const command = "git status | sh";
  const rules: AllowAlwaysRule[] = [
    { tool: "bash", kind: "exact", body: command },
  ];

  assert.equal(findSessionApproval(rules, bashRequest(command))?.kind, "exact");
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
    findSessionApproval(statusOnly, bashRequest("git status && git log")),
    undefined
  );
  assert.equal(
    findSessionApproval(statusAndLog, bashRequest("git status && git log"))?.kind,
    "wildcard"
  );
  assert.equal(
    findSessionApproval(statusAndLog, bashRequest("git status; git log"))?.kind,
    "wildcard"
  );
});

test("session exact full-command approvals still cover list sequences", () => {
  const command = "git status && git log";
  const rules: AllowAlwaysRule[] = [
    { tool: "bash", kind: "exact", body: command },
  ];

  assert.equal(findSessionApproval(rules, bashRequest(command))?.kind, "exact");
});

test("allow-always mode distinguishes one vs many segments", () => {
  const ask: PolicyResolution = { state: "ask", source: "tool" };

  assert.equal(resolveAllowAlwaysMode(bashRequest("git status"), ask), "wildcard");
  assert.equal(
    resolveAllowAlwaysMode(bashRequest("git status && git log"), ask),
    "wildcard-list"
  );
  assert.equal(
    resolveAllowAlwaysMode(bashRequest("git status | sh"), ask),
    "exact"
  );
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

  assert.equal(findSessionApproval(rules, request)?.kind, "exact");
  assert.equal(
    findSessionApproval(rules, { ...request, isExternalDirectory: false })?.kind,
    "exact"
  );
});
