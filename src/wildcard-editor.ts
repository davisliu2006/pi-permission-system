import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import { generateBashWildcard, generateBashWildcards } from "./ai-wildcard.ts";
import { STATUS_KEY } from "./constants.ts";
import {
  willGenerateBashWildcard,
  willGenerateBashWildcardList,
} from "./policy-bash.ts";
import { analyzeShellCommand } from "./shell.ts";
import {
  BROAD_WILDCARD_TITLE,
  formatBroadWildcardConfirm,
  formatBroadWildcardListConfirm,
  INVALID_WILDCARD_PREFIX,
  STATUS_GENERATING_WILDCARD,
  WILDCARD_EDITOR_TITLE,
  WILDCARD_LIST_EDITOR_TITLE,
} from "./ui-strings.ts";
import {
  validateWildcardSuggestion,
  validateWildcardSuggestions,
} from "./wildcard-validation.ts";
import type {
  AllowAlwaysRule,
  PermissionRequest,
  PolicyResolution,
} from "./types.ts";

/**
 * Single-command wildcard path (one LLM call, one editor).
 */
async function chooseOneWildcardRule(
  ctx: ExtensionContext,
  command: string
): Promise<AllowAlwaysRule | undefined> {
  ctx.ui.setStatus(STATUS_KEY, STATUS_GENERATING_WILDCARD);
  let suggestion: string | undefined;
  try {
    suggestion = await generateBashWildcard(ctx, command);
  } finally {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  let initial = suggestion ?? command;
  while (true) {
    const edited = await ctx.ui.editor(WILDCARD_EDITOR_TITLE, initial);
    if (edited === undefined) {return undefined;}

    const pattern = edited.trim();
    const validation = validateWildcardSuggestion(pattern, command);
    if (!validation.valid) {
      ctx.ui.notify(`${INVALID_WILDCARD_PREFIX}${validation.reason}`, "warning");
      initial = pattern || command;
      continue;
    }

    if (validation.broad) {
      const confirmed = await ctx.ui.confirm(
        BROAD_WILDCARD_TITLE,
        formatBroadWildcardConfirm(pattern)
      );
      if (!confirmed) {
        initial = pattern;
        continue;
      }
    }

    return { kind: "wildcard", tool: "bash", body: pattern };
  }
}

/**
 * Multi-command wildcard path (one LLM call for N patterns, one editor).
 */
async function chooseWildcardListRules(
  ctx: ExtensionContext,
  commands: readonly string[]
): Promise<AllowAlwaysRule[] | undefined> {
  ctx.ui.setStatus(STATUS_KEY, STATUS_GENERATING_WILDCARD);
  let suggestion: string[] | undefined;
  try {
    suggestion = await generateBashWildcards(ctx, commands);
  } finally {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  let initial = (suggestion ?? commands).join("; ");
  while (true) {
    const edited = await ctx.ui.editor(WILDCARD_LIST_EDITOR_TITLE, initial);
    if (edited === undefined) {return undefined;}

    const validation = validateWildcardSuggestions(edited, commands);
    if (!validation.valid) {
      ctx.ui.notify(`${INVALID_WILDCARD_PREFIX}${validation.reason}`, "warning");
      initial = edited.trim() || commands.join("; ");
      continue;
    }

    if (validation.broadPatterns.length > 0) {
      const confirmed = await ctx.ui.confirm(
        BROAD_WILDCARD_TITLE,
        formatBroadWildcardListConfirm(validation.broadPatterns)
      );
      if (!confirmed) {
        initial = validation.patterns.join("; ");
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
  policy: PolicyResolution
): Promise<AllowAlwaysRule[] | undefined> {
  if (willGenerateBashWildcard(request, policy)) {
    const rule = await chooseOneWildcardRule(ctx, request.body);
    return rule ? [rule] : undefined;
  }

  if (willGenerateBashWildcardList(request, policy)) {
    const analysis = analyzeShellCommand(request.body);
    return chooseWildcardListRules(ctx, analysis.segments);
  }

  return [{ kind: "exact", tool: request.toolName, body: request.body }];
}
