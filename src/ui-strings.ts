import {
  ALLOW_ALWAYS_EXACT,
  ALLOW_ALWAYS_WILDCARD,
} from "./constants.ts";
import { resolveAllowAlwaysMode } from "./policy-bash.ts";
import type { PermissionRequest, PolicyResolution } from "./types.ts";

export const STATUS_SUMMARIZING_REQUEST = "Summarizing permission request...";
export const STATUS_GENERATING_WILDCARD = "Generating bash wildcard...";

export const PERMISSION_DIALOG_TITLE = "Permission Required";
export const PERMISSION_DIALOG_QUESTION = "What should the agent be allowed to do?";
export const PURPOSE_PREFIX = "Purpose: ";

export const WILDCARD_EDITOR_TITLE = "Review bash wildcard";
export const WILDCARD_LIST_EDITOR_TITLE = "Review bash wildcards (semicolon-separated)";
export const BROAD_WILDCARD_TITLE = "Very broad wildcard";

const CHAINED_BASH_NOTE = "Shell chaining detected.";
const EXTERNAL_DIRECTORY_NOTE = "Outside the current working directory.";

function preview(value: string, limit: number): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

/**
 * Summary shown in the permission select dialog.
 */
export function buildSelectorSummary(request: PermissionRequest): string {
  const lines = [
    `Tool: ${request.toolName}`,
  ];

  if (request.bodyKind === "command") {
    lines.push(`Command: ${preview(request.body, 600)}`);
    if (request.bashAnalysis?.isComplex) {
      lines.push(CHAINED_BASH_NOTE);
    }
  } else if (request.bodyKind === "path") {
    lines.push(`Path: ${preview(request.body, 400)}`);
    if (request.isExternalDirectory) {
      lines.push(EXTERNAL_DIRECTORY_NOTE);
    }
  } else {
    lines.push(`Input: ${preview(request.body, 600)}`);
  }

  return lines.join("\n");
}

/**
 * Label for the "allow always" select option.
 */
export function formatAllowAlwaysOption(
  request: PermissionRequest,
  policy: PolicyResolution
): string {
  return resolveAllowAlwaysMode(request, policy) === "exact"
    ? ALLOW_ALWAYS_EXACT
    : ALLOW_ALWAYS_WILDCARD;
}

export function formatBroadWildcardConfirm(pattern: string): string {
  return `This pattern can match many commands:\n\n${pattern}\n\nSave it for this session?`;
}

export function formatBroadWildcardListConfirm(patterns: readonly string[]): string {
  return `These patterns can match many commands:\n\n${patterns.join("\n")}\n\nSave them for this session?`;
}
