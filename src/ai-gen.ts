import { complete, type Api, type Message, type Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseAiModelRef } from "./types.ts";

export interface CompleteTextOptions {
  systemPrompt: string;
  userText: string;
  maxTokens: number;
  timeoutMs: number;
  /** How to join multiple text blocks. Defaults to a single space. */
  joinWith?: string;
  /** Optional `provider/model-id` override. Falls back to the session model. */
  aiModel?: string;
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
 * Resolves the model for helper completions.
 */
export function resolveCompletionModel(
  ctx: ExtensionContext,
  aiModel?: string
): Model<Api> | undefined {
  if (aiModel) {
    const parsed = parseAiModelRef(aiModel);
    if (parsed) {
      const configured = ctx.modelRegistry.find(parsed.provider, parsed.modelId);
      if (configured && ctx.modelRegistry.hasConfiguredAuth(configured)) {
        return configured;
      }
    }
  }
  return ctx.model;
}

/**
 * Runs a single-turn text completion against the extension helper model.
 * Returns undefined when the model/auth is unavailable, the call aborts, or no text is returned.
 */
export async function completeText(
  ctx: ExtensionContext,
  options: CompleteTextOptions
): Promise<string | undefined> {
  const model = resolveCompletionModel(ctx, options.aiModel);
  if (!model) {return undefined;}

  try {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
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
      model,
      {
        systemPrompt: options.systemPrompt,
        messages: [message],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        maxTokens: options.maxTokens,
        signal: timeoutSignal(ctx.signal, options.timeoutMs),
      }
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
