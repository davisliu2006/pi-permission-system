import { findLastWildcardMatch, matchesWildcard } from "./matcher.ts";
import { hasShellChaining } from "./shell.ts";
import type {
  PermissionConfig,
  PermissionRequest,
  PermissionState,
  PolicyResolution,
  AllowAlwaysRule,
} from "./types.ts";

/**
 * Returns the permission for that tool if specified in the config.
 */
function configuredToolState(
  config: PermissionConfig,
  toolName: string,
): PermissionState | undefined {
  return Object.hasOwn(config.tools, toolName) ? config.tools[toolName] : undefined;
}

/**
 * Returns the permission for that tool or the default if not specified.
 */
function fallbackState(config: PermissionConfig, toolName: string): PermissionState {
  return configuredToolState(config, toolName) ?? config.default;
}

/**
 * Returns true the tool is a chained bash command.
 */
export function isChainedBashCommand(request: PermissionRequest): boolean {
  if (request.toolName !== "bash") {return false;}
  if (request.chainedBash === true) {return true;}
  return hasShellChaining(request.body);
}

/**
 * Returns the policy for the request using the correct precedence rules.
 */
export function resolvePolicy(
  config: PermissionConfig,
  request: PermissionRequest,
): PolicyResolution {
  if (request.externalDirectoryPath) { // external directory builtin tool
    const externalState = Object.hasOwn(config.external_directory, request.toolName)
      ? config.external_directory[request.toolName]
      : undefined;
    if (externalState) {
      return {
        state: externalState,
        source: "external",
        matchedPattern: request.toolName,
        chainedBash: false,
      };
    }
  }

  if (request.toolName === "bash") { // bash
    const chained = isChainedBashCommand(request);
    if (chained) { // chained bash - can't match wildcard
      return {
        state: fallbackState(config, "bash"),
        source: configuredToolState(config, "bash") ? "tool" : "default",
        chainedBash: true,
      };
    }

    const match = findLastWildcardMatch(config.bash, request.body);
    if (match) { // matched with wildcard
      return {
        state: match.state,
        source: "bash",
        matchedPattern: match.pattern,
        chainedBash: false,
      };
    }

    return { // fallback to default
      state: fallbackState(config, "bash"),
      source: configuredToolState(config, "bash") ? "tool" : "default",
      chainedBash: false,
    };
  }

  // other tool
  const toolState = configuredToolState(config, request.toolName);
  return {
    state: toolState ?? config.default,
    source: toolState ? "tool" : "default",
    chainedBash: false,
  };
}

/**
 * True if approved in session.
 */
export function findSessionApproval(
  rules: readonly AllowAlwaysRule[],
  request: PermissionRequest,
  chainedBash: boolean,
): AllowAlwaysRule | undefined {
  const isExternal = request.externalDirectoryPath !== undefined;

  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index]!;

    if (rule.scope === "external_directory") {
      if (!isExternal) {continue;}
      if (rule.tool !== request.toolName) {continue;}
      if (rule.body === request.body) {return rule;}
      continue;
    }

    if (isExternal) {continue;}
    if (rule.tool !== request.toolName) {continue;}

    if (rule.kind === "exact") {
      if (rule.body === request.body) {return rule;}
      continue;
    }

    if (rule.tool !== "bash" || request.bodyKind !== "command") {continue;}
    if (chainedBash) {continue;}
    if (matchesWildcard(rule.pattern, request.body)) {return rule;}
  }

  return undefined;
}

export function describePolicy(policy: PolicyResolution): string {
  if (policy.source === "bash" && policy.matchedPattern) {
    return `${policy.state} (matched bash rule ${JSON.stringify(policy.matchedPattern)})`;
  }
  if (policy.source === "external") {
    return `${policy.state} (external_directory rule for ${JSON.stringify(policy.matchedPattern ?? "")})`;
  }
  if (policy.source === "tool") {
    return `${policy.state} (tool rule)`;
  }
  return `${policy.state} (default)`;
}
