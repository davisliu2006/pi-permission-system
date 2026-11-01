import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { completeText } from "./ai-gen.ts";
import { buildWildcardInstructions, WILDCARD_SYSTEM_PROMPT } from "./prompts.ts";
import { validateWildcardSuggestion } from "./wildcard-validation.ts";

const WILDCARD_TIMEOUT_MS = 8000;
const MAX_WILDCARD_TOKENS = 120;

/**
 * Sanitizes against:
 * - ANSI terminal escapes
 * - Code blocks, quotes, backticks
 * - Consecutive whitespace
 */
function sanitizeWildcard(value: string): string | undefined {
  const normalized = value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/```(?:\w*\n)?([\s\S]*?)```/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  if (!normalized) {return undefined;}
  return normalized;
}

/**
 * Generates the bash wildcard recommendation.
 */
export async function generateBashWildcard(
  ctx: ExtensionContext,
  command: string
): Promise<string | undefined> {
  const text = await completeText(ctx, {
    systemPrompt: WILDCARD_SYSTEM_PROMPT,
    userText: buildWildcardInstructions(command),
    maxTokens: MAX_WILDCARD_TOKENS,
    timeoutMs: WILDCARD_TIMEOUT_MS,
    joinWith: "\n",
  });
  if (!text) {return undefined;}

  const pattern = sanitizeWildcard(text);
  if (!pattern) {return undefined;}

  const validation = validateWildcardSuggestion(pattern, command);
  if (!validation.valid) {return undefined;}

  return pattern;
}
