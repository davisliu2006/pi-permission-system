import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { completeText } from "./ai-gen.ts";
import { ALLOW, ASK, DEFAULT_AUTO_ALLOW_CRITERIA } from "./constants.ts";
import {
  buildClassifierInstructions,
  buildClassifierPromptContext,
  CLASSIFIER_SYSTEM_PROMPT,
} from "./prompts.ts";
import type { PermissionRequest } from "./types.ts";

const CLASSIFIER_TIMEOUT_MS = 5000;
const MAX_CLASSIFIER_TOKENS = 16;

export type AutoDecision = typeof ALLOW | typeof ASK;

/**
 * Parses a classifier reply.
 * Sanitizes against escape sequences, newlines, and punctuation.
 */
export function parseAutoDecision(text: string | undefined): AutoDecision {
  if (!text) {return ASK;}
  const line = text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`.,!:;]+$/g, "");
  return line === ALLOW ? ALLOW : ASK;
}

/**
 * Classifies whether an "auto" request should auto-allow or ask the user.
 * Leans towards "ask" in case of uncertainty.
 */
export async function classifyAutoPermission(
  ctx: ExtensionContext,
  request: PermissionRequest,
  aiModel?: string,
  allowCriteria?: string
): Promise<AutoDecision> {
  const criteria = allowCriteria?.trim() || DEFAULT_AUTO_ALLOW_CRITERIA;
  const text = await completeText(ctx, {
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    userText: buildClassifierInstructions(
      buildClassifierPromptContext(request),
      criteria
    ),
    maxTokens: MAX_CLASSIFIER_TOKENS,
    timeoutMs: CLASSIFIER_TIMEOUT_MS,
    aiModel,
  });
  return parseAutoDecision(text);
}
