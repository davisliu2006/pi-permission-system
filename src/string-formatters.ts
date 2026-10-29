import { CHAINED_BASH_NOTE, REJECT_DO_NOT_RETRY, REJECT_NEXT_STEP } from "./constants.ts";
import { describePolicy } from "./policy.ts";
import type { PermissionRequest, PolicyResolution } from "./types.ts";

export function describeRequestSubject(
  request: PermissionRequest,
  includeGenericSubject: boolean,
): string {
  if (request.bodyKind === "command") {
    return `bash command ${JSON.stringify(request.body)}`;
  }
  if (request.bodyKind === "path") {
    return `access to ${JSON.stringify(request.body)}`;
  }
  return includeGenericSubject
    ? `tool ${JSON.stringify(request.toolName)} with subject ${JSON.stringify(request.body)}`
    : `tool ${JSON.stringify(request.toolName)}`;
}

export function formatDenyReason(request: PermissionRequest, policy: PolicyResolution): string {
  const subject = describeRequestSubject(request, true);
  const chainedNote = policy.chainedBash ? ` ${CHAINED_BASH_NOTE}` : "";

  return `Permission denied for ${subject}. Policy: ${describePolicy(policy)}.${chainedNote} Hard stop: do not retry or investigate a bypass; report the denial to the user.`;
}

export function formatNoUiReason(request: PermissionRequest, policy: PolicyResolution): string {
  return `The ${request.toolName} request requires approval, but no interactive UI is available. Policy: ${describePolicy(policy)}.`;
}

export function formatRejectReason(request: PermissionRequest): string {
  const subject = describeRequestSubject(request, false);
  return `User rejected ${subject}. ${REJECT_NEXT_STEP} ${REJECT_DO_NOT_RETRY}`;
}
