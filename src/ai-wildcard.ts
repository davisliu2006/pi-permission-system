import { complete, type Message } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WILDCARD_INSTRUCTIONS, WILDCARD_SYSTEM_PROMPT } from "./prompts.ts";
import { validateWildcardSuggestion } from "./wildcard-validation.ts";

const WILDCARD_TIMEOUT_MS = 8000;
const MAX_WILDCARD_TOKENS = 120;

function timeoutSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(WILDCARD_TIMEOUT_MS);
  if (!signal) {return timeout;}
  if (typeof(AbortSignal.any) === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  return timeout;
}

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
  command: string,
  summary: string,
): Promise<string | undefined> {
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
          text: [
            ...WILDCARD_INSTRUCTIONS,
            "",
            `Command: ${JSON.stringify(command)}`,
            "",
            `Request summary:\n${summary}`,
          ].join("\n"),
        },
      ],
    };

    const response = await complete(
      ctx.model,
      {
        systemPrompt: WILDCARD_SYSTEM_PROMPT,
        messages: [message],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: MAX_WILDCARD_TOKENS,
        signal: timeoutSignal(ctx.signal),
      },
    );

    if (response.stopReason === "aborted") {return undefined;}

    const text = response.content
      .filter((content): content is { type: "text"; text: string } => content.type === "text")
      .map((content) => content.text)
      .join("\n");

    const pattern = sanitizeWildcard(text);
    if (!pattern) {return undefined;}

    const validation = validateWildcardSuggestion(pattern, command);
    if (!validation.valid) {return undefined;}

    return pattern;
  } catch {
    return undefined;
  }
}
