import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { completeText } from "./ai-gen.ts";
import { buildPurposeInstructions, PURPOSE_SYSTEM_PROMPT } from "./prompts.ts";
import type { PermissionRequest } from "./types.ts";

const PURPOSE_TIMEOUT_MS = 5000;
const MAX_PURPOSE_LENGTH = 200;
const MAX_PURPOSE_TOKENS = 120;

const purposeCache = new Map<string, string>();

function cacheKey(request: PermissionRequest): string {
  return `${request.toolName}\u0000${request.body}`;
}

/**
 * Sanitizes against:
 * - ANSI terminal escapes
 * - Code blocks, markdown formatting characters, quotes
 * - Consecutive whitespace
 */
function sanitizePurpose(value: string): string | undefined {
  const normalized = value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();

  if (!normalized) {return undefined;}
  return normalized.length > MAX_PURPOSE_LENGTH
    ? `${normalized.slice(0, MAX_PURPOSE_LENGTH)}...`
    : normalized;
}

/**
 * Generates a request purpose, using the cached version if it exists.
 */
export async function generateRequestPurpose(
  ctx: ExtensionContext,
  request: PermissionRequest,
  context: string,
  aiModel?: string
): Promise<string | undefined> {
  const key = cacheKey(request);
  const cached = purposeCache.get(key);
  if (cached) {return cached;}

  const text = await completeText(ctx, {
    systemPrompt: PURPOSE_SYSTEM_PROMPT,
    userText: buildPurposeInstructions(context),
    maxTokens: MAX_PURPOSE_TOKENS,
    timeoutMs: PURPOSE_TIMEOUT_MS,
    aiModel,
  });
  if (!text) {return undefined;}

  const purpose = sanitizePurpose(text);
  if (purpose) {purposeCache.set(key, purpose);}
  return purpose;
}

/**
 * Clears the generated purpose cache.
 */
export function clearPurposeCache(): void {
  purposeCache.clear();
}
