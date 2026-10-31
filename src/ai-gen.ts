import { complete, type Message } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface CompleteTextOptions {
  systemPrompt: string;
  userText: string;
  maxTokens: number;
  timeoutMs: number;
  /** How to join multiple text blocks. Defaults to a single space. */
  joinWith?: string;
}

/**
 * Signal sent ot the model to abort if the request takes too long.
 */
function timeoutSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) {return timeout;}
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  return timeout;
}

/**
 * Runs a single-turn text completion against the extension model.
 * Returns undefined when the model/auth is unavailable, the call aborts, or no text is returned.
 */
export async function completeText(
  ctx: ExtensionContext,
  options: CompleteTextOptions,
): Promise<string | undefined> {
  if (!ctx.model) {return undefined;}

  try {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
    if (!auth.ok || !auth.apiKey) {return undefined;}

    // prompt
    const message: Message = {
      role: "user",
      timestamp: Date.now(),
      content: [
        {
          type: "text",
          text: options.userText,
        },
      ],
    };

    // call model
    const response = await complete(
      ctx.model,
      {
        systemPrompt: options.systemPrompt,
        messages: [message],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: options.maxTokens,
        signal: timeoutSignal(ctx.signal, options.timeoutMs),
      },
    );

    if (response.stopReason === "aborted") {return undefined;}

    // extract text
    const text = response.content
      .filter((content): content is { type: "text"; text: string } => content.type === "text")
      .map((content) => content.text)
      .join(options.joinWith ?? " ")
      .trim();

    return text || undefined;
  } catch {
    return undefined;
  }
}
