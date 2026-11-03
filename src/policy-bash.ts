import { findLastWildcardMatch, matchesWildcard } from "./matcher.ts";
import { analyzeShellCommand, type ShellCommandAnalysis } from "./shell.ts";
import type {
  AllowAlwaysMode,
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

/**
 * Prefers the analysis stored on the request.
 * Falls back for hand-built fixtures.
 */
function bashAnalysisOf(request: PermissionRequest): ShellCommandAnalysis {
  return request.bashAnalysis ?? analyzeShellCommand(request.body);
}

/**
 * The general permission state for bash.
 */
function generalBashToolState(
  config: PermissionConfig
): PermissionState | undefined {
  return Object.hasOwn(config.tools, "bash") ? config.tools.bash : undefined;
}

function bashFallbackResolution(config: PermissionConfig): PolicyResolution {
  const toolState = generalBashToolState(config);
  return {
    state: toolState ?? config.default,
    source: toolState ? "tool" : "default",
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
    };
  }
  return bashFallbackResolution(config);
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
  const analysis = bashAnalysisOf(request);
  if (analysis.isComplex) {
    return bashFallbackResolution(config);
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
  request: PermissionRequest
): AllowAlwaysRule | undefined {
  // check full exact match first
  for (let index = rules.length - 1; index >= 0; index--) {
    const rule = rules[index]!;
    if (rule.tool === "bash" && rule.kind === "exact" && rule.body === request.body) {
      return rule;
    }
  }

  const analysis = bashAnalysisOf(request);
  if (analysis.isComplex) {return undefined;} // complex only has full exact match

  // check segments with wildcard / exact
  let lastMatch: AllowAlwaysRule | undefined;
  for (const segment of analysis.segments) {
    const match = findBashSegmentSessionApproval(rules, segment);
    if (!match) {return undefined;}
    lastMatch = match;
  }
  return lastMatch;
}

/**
 * How "allow always" should persist this request for the session.
 */
export function resolveAllowAlwaysMode(
  request: PermissionRequest,
  policy: PolicyResolution
): AllowAlwaysMode {
  if (request.isExternalDirectory && policy.source === "external") {return "exact";}
  if (request.toolName !== "bash") {return "exact";}

  const analysis = bashAnalysisOf(request);
  if (analysis.isComplex) {return "exact";}
  if (analysis.segments.length > 1) {return "wildcard-list";}
  if (analysis.segments.length === 1) {return "wildcard";}
  return "exact";
}
