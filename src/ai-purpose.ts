import { complete, type Message } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PURPOSE_INSTRUCTIONS, PURPOSE_SYSTEM_PROMPT } from "./prompts.ts";
import type { PermissionRequest } from "./types.ts";

const PURPOSE_TIMEOUT_MS = 5000;
const MAX_PURPOSE_LENGTH = 200;
const MAX_PURPOSE_TOKENS = 120;

const purposeCache = new Map<string, string>();

function cacheKey(request: PermissionRequest): string {
  return `${request.toolName}\u0000${request.body}`;
}

function timeoutSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(PURPOSE_TIMEOUT_MS);
  if (!signal) {return timeout;}
  if (typeof(AbortSignal.any) === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  return timeout;
}

/**
 * Sanitizes against:
 * - ANSI terminal escapes
 * - Code blocks, markdown formatting characters, quotes
 * - Consecutive whitespace
 */
export function sanitizePurpose(value: string): string | undefined {
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
    ? `${normalized.slice(0, MAX_PURPOSE_LENGTH - 3)}...`
    : normalized;
}

/**
 * Generates a request purpose, using the cached version if it exists.
 */
export async function generateRequestPurpose(
  ctx: ExtensionContext,
  request: PermissionRequest,
  summary: string,
): Promise<string | undefined> {
  const key = cacheKey(request);
  const cached = purposeCache.get(key);
  if (cached) {return cached;}
  if (!ctx.model) {return undefined;}

  try {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
    if (!auth.ok || !auth.apiKey) {return undefined;}

    const message: Message = {
      role: "user",
      timestamp: Date.now(),
      content: [
        {
          type: "text",
          text: [...PURPOSE_INSTRUCTIONS, "", `Request summary:\n${summary}`].join("\n"),
        },
      ],
    };

    const response = await complete(
      ctx.model,
      {
        systemPrompt: PURPOSE_SYSTEM_PROMPT,
        messages: [message],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: MAX_PURPOSE_TOKENS,
        signal: timeoutSignal(ctx.signal),
      },
    );

    if (response.stopReason === "aborted") {return undefined;}

    const text = response.content
      .filter((content): content is { type: "text"; text: string } => content.type === "text")
      .map((content) => content.text)
      .join(" ");

    const purpose = sanitizePurpose(text);
    if (purpose) {purposeCache.set(key, purpose);}
    return purpose;
  } catch {
    return undefined;
  }
}

/**
 * Clears the generated purpose cache.
 */
export function clearPurposeCache(): void {
  purposeCache.clear();
}
