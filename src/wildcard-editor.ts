import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { generateBashWildcard, generateBashWildcards } from "./ai-wildcard.ts";
import { STATUS_KEY } from "./constants.ts";
import { resolveAllowAlwaysMode } from "./policy-bash.ts";
import { analyzeShellCommand } from "./shell.ts";
import {
  BROAD_WILDCARD_TITLE,
  formatBroadWildcardConfirm,
  formatBroadWildcardListConfirm,
  STATUS_GENERATING_WILDCARD,
  WILDCARD_EDITOR_TITLE,
  WILDCARD_LIST_EDITOR_TITLE,
} from "./ui-strings.ts";
import { INVALID_WILDCARD_PREFIX } from "./warning-strings.ts";
import {
  validateWildcardSuggestion,
  validateWildcardSuggestionList,
} from "./wildcard-validation.ts";
import type {
  AllowAlwaysRule,
  PermissionRequest,
  PolicyResolution,
} from "./types.ts";

/**
 * Single-command wildcard path.
 */
async function chooseSingleWildcard(
  ctx: ExtensionContext,
  command: string,
  aiModel?: string
): Promise<AllowAlwaysRule | undefined> {
  ctx.ui.setStatus(STATUS_KEY, STATUS_GENERATING_WILDCARD);
  let suggestion: string | undefined;
  try {
    suggestion = await generateBashWildcard(ctx, command, aiModel);
  } finally {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  let current = suggestion ?? command;
  while (true) {
    const edited = await ctx.ui.editor(WILDCARD_EDITOR_TITLE, current);
    if (edited === undefined) {return undefined;}

    const pattern = edited.trim();
    const validation = validateWildcardSuggestion(pattern, command);
    if (!validation.valid) {
      ctx.ui.notify(`${INVALID_WILDCARD_PREFIX}${validation.reason}`, "warning");
      current = pattern || command;
      continue;
    }

    if (validation.broad) {
      const confirmed = await ctx.ui.confirm(
        BROAD_WILDCARD_TITLE,
        formatBroadWildcardConfirm(pattern)
      );
      if (!confirmed) {
        current = pattern;
        continue;
      }
    }

    return { kind: "wildcard", tool: "bash", body: pattern };
  }
}

/**
 * Multi-command wildcard path.
 */
async function chooseWildcardListRules(
  ctx: ExtensionContext,
  commands: readonly string[],
  aiModel?: string
): Promise<AllowAlwaysRule[] | undefined> {
  ctx.ui.setStatus(STATUS_KEY, STATUS_GENERATING_WILDCARD);
  let suggestion: string[] | undefined;
  try {
    suggestion = await generateBashWildcards(ctx, commands, aiModel);
  } finally {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  let current = (suggestion ?? commands).join("; ");
  while (true) {
    const edited = await ctx.ui.editor(WILDCARD_LIST_EDITOR_TITLE, current);
    if (edited === undefined) {return undefined;}

    const validation = validateWildcardSuggestionList(edited, commands);
    if (!validation.valid) {
      ctx.ui.notify(`${INVALID_WILDCARD_PREFIX}${validation.reason}`, "warning");
      current = edited.trim() || commands.join("; ");
      continue;
    }

    if (validation.broadPatterns.length > 0) {
      const confirmed = await ctx.ui.confirm(
        BROAD_WILDCARD_TITLE,
        formatBroadWildcardListConfirm(validation.broadPatterns)
      );
      if (!confirmed) {
        current = validation.patterns.join("; ");
        continue;
      }
    }

    return validation.patterns.map((pattern) => ({
      kind: "wildcard" as const,
      tool: "bash" as const,
      body: pattern,
    }));
  }
}

/**
 * Selects the "allow always" matching rules for the request.
 */
export async function chooseAlwaysRules(
  ctx: ExtensionContext,
  request: PermissionRequest,
  policy: PolicyResolution,
  aiModel?: string
): Promise<AllowAlwaysRule[] | undefined> {
  const mode = resolveAllowAlwaysMode(request, policy);

  if (mode === "wildcard") {
    const rule = await chooseSingleWildcard(ctx, request.body, aiModel);
    return rule ? [rule] : undefined;
  }

  if (mode === "wildcard-list") {
    const analysis = request.bashAnalysis ?? analyzeShellCommand(request.body);
    return chooseWildcardListRules(ctx, analysis.segments, aiModel);
  }

  return [{ kind: "exact", tool: request.toolName, body: request.body }];
}
