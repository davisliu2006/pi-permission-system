import { findLastWildcardMatch, matchesWildcard } from "./matcher.ts";
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
 * Returns the policy for the request using the correct precedence rules.
 */
export function resolvePolicy(
  config: PermissionConfig,
  request: PermissionRequest,
): PolicyResolution {
  if (request.isExternalDirectory) { // external directory builtin tool
    const externalState = Object.hasOwn(config.external_directory, request.toolName)
      ? config.external_directory[request.toolName]
      : undefined;
    if (externalState) {
      return {
        state: externalState,
        source: "external",
        matchedPattern: request.toolName,
        isChainedBash: false,
      };
    }
  }

  if (request.toolName === "bash") { // bash
    const chained = request.isChainedBash === true;
    if (chained) { // chained bash - can't match wildcard
      return {
        state: fallbackState(config, "bash"),
        source: configuredToolState(config, "bash") ? "tool" : "default",
        isChainedBash: true,
      };
    }

    const match = findLastWildcardMatch(config.bash, request.body);
    if (match) { // matched with wildcard
      return {
        state: match.state,
        source: "bash",
        matchedPattern: match.pattern,
        isChainedBash: false,
      };
    }

    return { // fallback to default
      state: fallbackState(config, "bash"),
      source: configuredToolState(config, "bash") ? "tool" : "default",
      isChainedBash: false,
    };
  }

  // other tool
  const toolState = configuredToolState(config, request.toolName);
  return {
    state: toolState ?? config.default,
    source: toolState ? "tool" : "default",
    isChainedBash: false,
  };
}

/**
 * True if approved in session.
 */
export function findSessionApproval(
  rules: readonly AllowAlwaysRule[],
  request: PermissionRequest,
  isChainedBash: boolean,
): AllowAlwaysRule | undefined {
  const isExternal = request.isExternalDirectory === true;

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
    if (isChainedBash) {continue;}
    if (matchesWildcard(rule.body, request.body)) {return rule;}
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

/**
 * True when "Allow Always" will generate a bash wildcard instead of an exact rule.
 * Mirrors the branching in chooseAlwaysRule.
 */
export function willGenerateBashWildcard(
  request: PermissionRequest,
  policy: PolicyResolution,
): boolean {
  if (request.isExternalDirectory && policy.source === "external") {return false;}
  if (request.toolName !== "bash") {return false;}
  if (policy.isChainedBash) {return false;}
  return true;
}
