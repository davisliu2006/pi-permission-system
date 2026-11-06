import type { Theme } from "@earendil-works/pi-coding-agent";
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

export const WILDCARD_EDITOR_TITLE = "Review bash wildcard";
export const WILDCARD_LIST_EDITOR_TITLE = "Review bash wildcards (semicolon-separated)";
export const BROAD_WILDCARD_TITLE = "Very broad wildcard";

const CHAINED_BASH_NOTE = "Shell chaining detected.";
const EXTERNAL_DIRECTORY_NOTE = "Outside the current working directory.";

type SummaryLine = {
  label?: string;
  value: string;
};

function preview(value: string, limit: number): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function buildSelectorSummaryLines(
  request: PermissionRequest,
  purpose?: string
): SummaryLine[] {
  const lines: SummaryLine[] = [
    { label: "Tool", value: request.toolName },
  ];
  if (request.bodyKind === "command") {
    lines.push({ label: "Command", value: preview(request.body, 600) });
    if (request.bashAnalysis?.isComplex) {
      lines.push({ value: CHAINED_BASH_NOTE });
    }
  } else if (request.bodyKind === "path") {
    lines.push({ label: "Path", value: preview(request.body, 400) });
    if (request.isExternalDirectory) {
      lines.push({ value: EXTERNAL_DIRECTORY_NOTE });
    }
  } else {
    lines.push({ label: "Input", value: preview(request.body, 600) });
  }
  if (purpose) {
    lines.push({ label: "Purpose", value: purpose });
  }
  return lines;
}

/**
 * Plain summary shown in the non-TUI permission dialog.
 */
export function buildPlainSelectorSummary(
  request: PermissionRequest,
  purpose?: string
): string {
  return buildSelectorSummaryLines(request, purpose)
    .map((line) => (
      line.label ? `${line.label}: ${line.value}` : line.value)
    )
    .join("\n");
}

/**
 * Styled summary lines shown in the TUI permission dialog.
 */
export function buildStyledSelectorSummary(
  theme: Theme,
  request: PermissionRequest,
  purpose?: string
): string[] {
  return buildSelectorSummaryLines(request, purpose).map((line) => {
    if (!line.label) {
      return theme.fg("muted", line.value);
    }
    if (line.label === "Purpose") {
      return theme.fg("accent", theme.bold(`${line.label}:`))
        + theme.fg("muted", ` ${line.value}`);
    }
    return theme.fg("accent", theme.bold(`${line.label}:`))
      + theme.fg("text", ` ${line.value}`);
  });
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
