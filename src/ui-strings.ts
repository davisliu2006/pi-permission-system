import {
  ALLOW_ALWAYS_EXACT,
  ALLOW_ALWAYS_WILDCARD,
} from "./constants.ts";
import { willGenerateBashWildcard } from "./policy.ts";
import type { PermissionRequest, PolicyResolution } from "./types.ts";

export const STATUS_SUMMARIZING_REQUEST = "Summarizing permission request...";
export const STATUS_GENERATING_WILDCARD = "Generating bash wildcard...";

export const PERMISSION_DIALOG_TITLE = "Permission Required";
export const PERMISSION_DIALOG_QUESTION = "What should the agent be allowed to do?";
export const PURPOSE_PREFIX = "Purpose: ";

export const WILDCARD_EDITOR_TITLE = "Review bash wildcard";
export const BROAD_WILDCARD_TITLE = "Very broad wildcard";
export const INVALID_WILDCARD_PREFIX = "Invalid wildcard: ";

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
    lines.push(`Command: \`${preview(request.body, 600)}\``);
    if (request.isChainedBash) {
      lines.push(CHAINED_BASH_NOTE);
    }
  } else if (request.bodyKind === "path") {
    lines.push(`Path: ${request.body}`);
    if (request.isExternalDirectory) {
      lines.push(EXTERNAL_DIRECTORY_NOTE);
    }
  } else {
    lines.push(`Input: ${preview(request.body, 400)}`);
  }

  return preview(lines.join("\n"), 1200);
}

/**
 * Label for the "Allow Always" select option.
 */
export function formatAllowAlwaysOption(
  request: PermissionRequest,
  policy: PolicyResolution,
): string {
  return willGenerateBashWildcard(request, policy)
    ? ALLOW_ALWAYS_WILDCARD
    : ALLOW_ALWAYS_EXACT;
}

export function formatBroadWildcardConfirm(pattern: string): string {
  return `This pattern can match many commands:\n\n${pattern}\n\nSave it for this session?`;
}
