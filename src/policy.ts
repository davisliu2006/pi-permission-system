import { findLastWildcardMatch, matchesWildcard } from "./matcher.ts";
import { analyzeShellCommand } from "./shell.ts";
import type {
  PermissionConfig,
  PermissionRequest,
  PermissionState,
  PolicyResolution,
  AllowAlwaysRule,
} from "./types.ts";

const STATE_RANK: Record<PermissionState, number> = {
  allow: 0,
  ask: 1,
  deny: 2,
};

/**
 * Returns the permission for that tool if specified in the config.
 */
function configuredToolState(
  config: PermissionConfig,
  toolName: string
): PermissionState | undefined {
  return Object.hasOwn(config.tools, toolName) ? config.tools[toolName] : undefined;
}

/**
 * Returns the permission for that tool or the default if not specified.
 */
function fallbackState(config: PermissionConfig, toolName: string): PermissionState {
  return configuredToolState(config, toolName) ?? config.default;
}

function bashFallbackResolution(config: PermissionConfig, isChainedBash: boolean): PolicyResolution {
  return {
    state: fallbackState(config, "bash"),
    source: configuredToolState(config, "bash") ? "tool" : "default",
    isChainedBash,
  };
}

/**
 * Resolves one simple bash segment against bash rules, then tools.bash / default.
 */
function resolveBashSegment(config: PermissionConfig, segment: string): PolicyResolution {
  const match = findLastWildcardMatch(config.bash, segment);
  if (match) {
    return {
      state: match.state,
      source: "bash",
      matchedPattern: match.pattern,
      isChainedBash: false,
    };
  }
  return bashFallbackResolution(config, false);
}

/**
 * Worst state wins across simple `;` / newline segments.
 * When ranks tie, keep the later segment's resolution.
 */
function combineBashSegmentResolutions(resolutions: PolicyResolution[]): PolicyResolution {
  let worst = resolutions[0]!;
  for (let index = 1; index < resolutions.length; index++) {
    const next = resolutions[index]!;
    if (STATE_RANK[next.state] >= STATE_RANK[worst.state]) {
      worst = next;
    }
  }
  return worst;
}

/**
 * Returns the policy for the request using the correct precedence rules.
 */
export function resolvePolicy(
  config: PermissionConfig,
  request: PermissionRequest
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

  if (request.toolName === "bash") {
    const analysis = analyzeShellCommand(request.body);
    if (analysis.isComplex) {
      // pipes / && / substitutions / etc. - skip bash patterns
      return bashFallbackResolution(config, true);
    }

    const resolutions = analysis.segments.map((segment) => resolveBashSegment(config, segment));
    return combineBashSegmentResolutions(resolutions);
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
 * Helper for bash session approval.
 */
function findBashSegmentSessionApproval(
  rules: readonly AllowAlwaysRule[],
  segment: string
): AllowAlwaysRule | undefined {
  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (rule.tool !== "bash") {continue;}
    if (rule.kind === "exact" && rule.body === segment) {return rule;}
    if (matchesWildcard(rule.body, segment)) {return rule;}
  }
  return undefined;
}

/**
 * Helper for bash session approval.
 */
function findBashSessionApproval(
  rules: readonly AllowAlwaysRule[],
  request: PermissionRequest,
  isChainedBash: boolean
): AllowAlwaysRule | undefined {
  //check full exact match first
  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (rule.tool === "bash" && rule.kind === "exact" && rule.body === request.body) {
      return rule;
    }
  }

  if (isChainedBash) {return undefined;} // chained only has full exact match

  // check segments with wildcard
  const analysis = analyzeShellCommand(request.body);
  let lastMatch: AllowAlwaysRule | undefined;
  for (const segment of analysis.segments) {
    const match = findBashSegmentSessionApproval(rules, segment);
    if (!match) {return undefined;}
    lastMatch = match;
  }
  return lastMatch;
}

/**
 * True if approved in session.
 */
export function findSessionApproval(
  rules: readonly AllowAlwaysRule[],
  request: PermissionRequest,
  isChainedBash: boolean
): AllowAlwaysRule | undefined {
  if (request.toolName === "bash") {
    return findBashSessionApproval(rules, request, isChainedBash);
  }

  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (
      rule.kind === "exact"
      && rule.tool === request.toolName
      && rule.body === request.body
    ) {return rule;}
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
  policy: PolicyResolution
): boolean {
  if (request.isExternalDirectory && policy.source === "external") {return false;}
  if (request.toolName !== "bash") {return false;}
  if (policy.isChainedBash) {return false;}
  // Multi-command sequences save an exact rule for the whole string.
  const analysis = analyzeShellCommand(request.body);
  if (analysis.isComplex || analysis.segments.length !== 1) {return false;}
  return true;
}
