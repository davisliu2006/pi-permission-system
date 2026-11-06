import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { completeText } from "./ai-gen.ts";
import {
  buildWildcardInstructions,
  buildWildcardListInstructions,
  WILDCARD_LIST_SYSTEM_PROMPT,
  WILDCARD_SYSTEM_PROMPT,
} from "./prompts.ts";
import {
  validateWildcardSuggestion,
  validateWildcardSuggestionList,
} from "./wildcard-validation.ts";

const WILDCARD_TIMEOUT_MS = 8000;
const MAX_WILDCARD_TOKENS = 120;
const MAX_WILDCARD_LIST_TOKENS = 240;

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
 * Generates one bash wildcard recommendation.
 */
export async function generateBashWildcard(
  ctx: ExtensionContext,
  command: string,
  aiModel?: string
): Promise<string | undefined> {
  const text = await completeText(ctx, {
    systemPrompt: WILDCARD_SYSTEM_PROMPT,
    userText: buildWildcardInstructions(command),
    maxTokens: MAX_WILDCARD_TOKENS,
    timeoutMs: WILDCARD_TIMEOUT_MS,
    joinWith: "\n",
    aiModel,
  });
  if (!text) {return undefined;}

  const pattern = sanitizeWildcard(text);
  if (!pattern) {return undefined;}

  const validation = validateWildcardSuggestion(pattern, command);
  if (!validation.valid) {return undefined;}

  return pattern;
}

/**
 * Generates a list of bash wildcards.
 * Expects semicolon-separated patterns back.
 */
export async function generateBashWildcards(
  ctx: ExtensionContext,
  commands: readonly string[],
  aiModel?: string
): Promise<string[] | undefined> {
  if (commands.length === 0) {return undefined;}

  const text = await completeText(ctx, {
    systemPrompt: WILDCARD_LIST_SYSTEM_PROMPT,
    userText: buildWildcardListInstructions(commands),
    maxTokens: MAX_WILDCARD_LIST_TOKENS,
    timeoutMs: WILDCARD_TIMEOUT_MS,
    joinWith: "\n",
    aiModel,
  });
  if (!text) {return undefined;}

  const sanitized = sanitizeWildcard(text);
  if (!sanitized) {return undefined;}

  const validation = validateWildcardSuggestionList(sanitized, commands);
  if (!validation.valid) {return undefined;}

  return validation.patterns;
}
