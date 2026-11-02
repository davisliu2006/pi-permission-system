import {
  findBashSessionApproval,
  resolveBashPolicy,
} from "./policy-bash.ts";
import type {
  PermissionConfig,
  PermissionRequest,
  PermissionState,
  PolicyResolution,
  AllowAlwaysRule,
} from "./types.ts";

export {
  willGenerateBashWildcard,
  willGenerateBashWildcardList,
  usesBashWildcardAllowAlways,
} from "./policy-bash.ts";

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
    return resolveBashPolicy(config, request);
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
