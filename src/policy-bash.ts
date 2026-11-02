import { findLastWildcardMatch, matchesWildcard } from "./matcher.ts";
import { analyzeShellCommand } from "./shell.ts";
import type {
  AllowAlwaysRule,
  PermissionConfig,
  PermissionRequest,
  PermissionState,
  PolicyResolution,
} from "./types.ts";

const STATE_RANK: Record<PermissionState, number> = {
  allow: 0,
  ask: 1,
  deny: 2,
};

function configuredBashToolState(
  config: PermissionConfig
): PermissionState | undefined {
  return Object.hasOwn(config.tools, "bash") ? config.tools.bash : undefined;
}

function bashFallbackState(config: PermissionConfig): PermissionState {
  return configuredBashToolState(config) ?? config.default;
}

function bashFallbackResolution(
  config: PermissionConfig,
  isChainedBash: boolean
): PolicyResolution {
  return {
    state: bashFallbackState(config),
    source: configuredBashToolState(config) ? "tool" : "default",
    isChainedBash,
  };
}

/**
 * Resolves one simple bash segment against bash rules, then tools.bash / default.
 */
function resolveBashSegment(
  config: PermissionConfig,
  segment: string
): PolicyResolution {
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
 * Worst state wins across simple list segments.
 * When ranks tie, keep the later segment's resolution.
 */
function combineBashSegmentResolutions(
  resolutions: PolicyResolution[]
): PolicyResolution {
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
 * Resolves bash policy, including simple list splitting.
 */
export function resolveBashPolicy(
  config: PermissionConfig,
  request: PermissionRequest
): PolicyResolution {
  const analysis = analyzeShellCommand(request.body);
  if (analysis.isComplex) {
    // pipes / substitutions / etc. - skip bash patterns
    return bashFallbackResolution(config, true);
  }

  const resolutions = analysis.segments.map((segment) =>
    resolveBashSegment(config, segment)
  );
  return combineBashSegmentResolutions(resolutions);
}

/**
 * Newest matching bash rule for one command segment.
 */
function findBashSegmentSessionApproval(
  rules: readonly AllowAlwaysRule[],
  segment: string
): AllowAlwaysRule | undefined {
  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (rule.tool !== "bash") {continue;}
    if (rule.kind === "exact") {
      if (rule.body === segment) {return rule;}
      continue;
    }
    if (matchesWildcard(rule.body, segment)) {return rule;}
  }
  return undefined;
}

/**
 * Session approval for bash, including per-segment matching for simple lists.
 */
export function findBashSessionApproval(
  rules: readonly AllowAlwaysRule[],
  request: PermissionRequest,
  isChainedBash: boolean
): AllowAlwaysRule | undefined {
  // check full exact match first
  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (rule.tool === "bash" && rule.kind === "exact" && rule.body === request.body) {
      return rule;
    }
  }

  if (isChainedBash) {return undefined;} // chained only has full exact match

  // check segments with wildcard / exact
  const analysis = analyzeShellCommand(request.body);
  let lastMatch: AllowAlwaysRule | undefined;
  for (const segment of analysis.segments) {
    const match = findBashSegmentSessionApproval(rules, segment);
    if (!match) {return undefined;}
    lastMatch = match;
  }
  return lastMatch;
}

function bashWildcardAnalysis(
  request: PermissionRequest,
  policy: PolicyResolution
): { isComplex: boolean; segments: string[] } | undefined {
  if (request.isExternalDirectory && policy.source === "external") {return undefined;}
  if (request.toolName !== "bash") {return undefined;}
  if (policy.isChainedBash) {return undefined;}
  return analyzeShellCommand(request.body);
}

/**
 * True when "Allow Always" will generate one bash wildcard for a single command.
 */
export function willGenerateBashWildcard(
  request: PermissionRequest,
  policy: PolicyResolution
): boolean {
  const analysis = bashWildcardAnalysis(request, policy);
  return analysis !== undefined && !analysis.isComplex && analysis.segments.length === 1;
}

/**
 * True when "Allow Always" will generate one bash wildcard per list segment.
 */
export function willGenerateBashWildcardList(
  request: PermissionRequest,
  policy: PolicyResolution
): boolean {
  const analysis = bashWildcardAnalysis(request, policy);
  return analysis !== undefined && !analysis.isComplex && analysis.segments.length > 1;
}

/**
 * True when "Allow Always" uses any bash wildcard path (one or many).
 */
export function usesBashWildcardAllowAlways(
  request: PermissionRequest,
  policy: PolicyResolution
): boolean {
  return willGenerateBashWildcard(request, policy) || willGenerateBashWildcardList(request, policy);
}
