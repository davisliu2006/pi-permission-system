import { CHAINED_BASH_NOTE, EXTERNAL_DIRECTORY_NOTE } from "./constants.ts";
import { describePolicy } from "./policy.ts";
import type { PermissionRequest, PolicyResolution } from "./types.ts";

const MAX_BODY_PREVIEW = 600;

function preview(value: string, limit = MAX_BODY_PREVIEW): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function inputPreview(input: unknown): string {
  if (input === undefined) {return "(none)";}
  try {
    const json = JSON.stringify(input);
    return preview(json ?? String(input), 400);
  } catch {
    return "(unserializable input)";
  }
}

export function buildRequestSummary(
  request: PermissionRequest,
  policy: PolicyResolution,
): string {
  const lines = [
    `Tool: ${request.toolName}`,
    `Policy: ${describePolicy(policy)}`,
  ];

  if (request.bodyKind === "command") {
    lines.push(`Command:\n${preview(request.body)}`);
    if (policy.chainedBash) {
      lines.push(CHAINED_BASH_NOTE);
    }
  } else if (request.bodyKind === "path") {
    lines.push(`Path: ${request.body}`);
    if (request.externalDirectoryPath) {
      lines.push(EXTERNAL_DIRECTORY_NOTE);
    }
  } else if (request.bodyKind === "target") {
    lines.push(`Target: ${request.body}`);
  } else {
    lines.push(`Subject: ${request.body}`);
  }

  if (request.bodyKind !== "path" && request.bodyKind !== "command") {
    lines.push(`Input: ${inputPreview(request.input)}`);
  }

  return preview(lines.join("\n"), 1200);
}
