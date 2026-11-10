import { ALLOW, ASK } from "./constants.ts";
import type { PermissionRequest } from "./types.ts";

export type AutoDecision = typeof ALLOW | typeof ASK;

/**
 * Classifies whether an "auto" request should auto-allow or ask the user.
 * Leans towards "ask" in case of uncertainty.
 */
export async function classifyAutoPermission(
  _request: PermissionRequest,
  _aiModel?: string
): Promise<AutoDecision> {
  return ASK;
}
