import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

import { clearPurposeCache, generateRequestPurpose } from "./ai-purpose.ts";
import { generateBashWildcard } from "./ai-wildcard.ts";
import {
  ALLOW,
  BROAD_WILDCARD_TITLE,
  CONFIG_FILENAME,
  CONFIG_WARNING_PREFIX,
  DENY,
  INVALID_WILDCARD_PREFIX,
  MAX_CONFIG_WARNINGS,
  REJECT_FOLLOW_UP_MESSAGE,
  STATUS_GENERATING_WILDCARD,
  STATUS_KEY,
  STATUS_SUMMARIZING_REQUEST,
  WILDCARD_EDITOR_TITLE,
} from "./constants.ts";
import { loadMergedConfig } from "./config.ts";
import { promptForPermission } from "./permission-dialog.ts";
import { findSessionApproval, resolvePolicy } from "./policy.ts";
import { buildRequest } from "./request-builder.ts";
import { SessionApprovalStore } from "./session-approvals.ts";
import { formatDenyReason, formatNoUiReason, formatRejectReason } from "./string-formatters.ts";
import { buildRequestSummary } from "./summaries.ts";
import { validateWildcardSuggestion } from "./wildcard-validation.ts";
import {
  type PermissionConfig,
  type PermissionRequest,
  type PolicyResolution,
  type AllowAlwaysRule,
} from "./types.ts";

interface ExtensionState {
  config?: PermissionConfig;
  configCwd?: string;
  readonly approvals: SessionApprovalStore;
}

/**
 * Create an empty extension state.
 */
function createNewState(): ExtensionState {
  return { approvals: new SessionApprovalStore() };
}

/**
 * Loads config for the cwd.
 * Displays any warnings that are generated.
 */
async function loadConfig(ctx: ExtensionContext): Promise<PermissionConfig> {
  const { config, warnings } = await loadMergedConfig(
    join(getAgentDir(), CONFIG_FILENAME),
    join(ctx.cwd, CONFIG_FILENAME),
  );

  if (ctx.hasUI) {
    for (const warning of warnings.slice(0, MAX_CONFIG_WARNINGS)) {
      ctx.ui.notify(`${CONFIG_WARNING_PREFIX}${warning.message}`, "warning");
    }
    if (warnings.length > MAX_CONFIG_WARNINGS) {
      const suppressed = warnings.length - MAX_CONFIG_WARNINGS;
      ctx.ui.notify(
        `${CONFIG_WARNING_PREFIX}${suppressed} additional config warning(s) suppressed.`,
        "warning",
      );
    }
  }

  return config;
}

/**
 * Selects the "allow always" matching rule for the request.
 */
async function chooseAlwaysRule(
  ctx: ExtensionContext,
  request: PermissionRequest,
  policy: PolicyResolution,
  summary: string,
): Promise<AllowAlwaysRule | undefined> {
  if (request.externalDirectoryPath && policy.source === "external") {
    return {
      scope: "external_directory",
      tool: request.toolName,
      kind: "exact",
      body: request.body,
    };
  }

  if (request.toolName !== "bash") {
    return { scope: "tool", tool: request.toolName, kind: "exact", body: request.body };
  }

  if (policy.chainedBash) {
    return { scope: "tool", tool: "bash", kind: "exact", body: request.body };
  }

  ctx.ui.setStatus(STATUS_KEY, STATUS_GENERATING_WILDCARD);
  let suggestion: string | undefined;
  try {
    suggestion = await generateBashWildcard(ctx, request.body, summary);
  } finally {
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  let initial = suggestion ?? request.body;

  while (true) {
    const edited = await ctx.ui.editor(WILDCARD_EDITOR_TITLE, initial);
    if (edited === undefined) {return undefined;}

    const pattern = edited.trim();
    const validation = validateWildcardSuggestion(pattern, request.body);
    if (!validation.valid) {
      ctx.ui.notify(`${INVALID_WILDCARD_PREFIX}${validation.reason}`, "warning");
      initial = pattern || request.body;
      continue;
    }

    if (validation.broad) {
      const confirmed = await ctx.ui.confirm(
        BROAD_WILDCARD_TITLE,
        `This pattern can match many commands:\n\n${pattern}\n\nSave it for this session?`,
      );
      if (!confirmed) {
        initial = pattern;
        continue;
      }
    }

    return {
      scope: "tool",
      tool: "bash",
      kind: "wildcard",
      pattern,
    };
  }
}

/**
 * Rejects the request and instructs the agent to follow up.
 */
async function rejectRequest(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  request: PermissionRequest,
): Promise<{ block: true; reason: string }> {
  const reason = formatRejectReason(request);
  try {
    ctx.abort();
  } catch {
    // Best effort. The block reason still instructs the agent.
  }
  try {
    pi.sendUserMessage(REJECT_FOLLOW_UP_MESSAGE, { deliverAs: "followUp" });
  } catch {
    // The block reason remains the fallback when a follow-up cannot be queued.
  }
  return { block: true, reason };
}

/**
 * Registers the extension.
 */
export function registerPermissionSystem(pi: ExtensionAPI): void {
  const state = createNewState();

  /**
   * Ensures the config matches with the cwd.
   */
  const ensureConfig = async (ctx: ExtensionContext): Promise<PermissionConfig> => {
    if (state.config && state.configCwd === ctx.cwd) {return state.config;}
    const config = await loadConfig(ctx);
    state.config = config;
    state.configCwd = ctx.cwd;
    return config;
  };

  // session start
  pi.on("session_start", async (_event, ctx) => {
    state.approvals.clear();
    clearPurposeCache();
    state.config = undefined;
    state.configCwd = undefined;
    state.config = await ensureConfig(ctx);
  });

  // session end
  pi.on("session_shutdown", () => {
    state.approvals.clear();
    clearPurposeCache();
  });

  // tool called
  pi.on("tool_call", async (event, ctx) => {
    const request = await buildRequest(event.toolName, event.input, ctx.cwd);
    const config = await ensureConfig(ctx);
    const policy = resolvePolicy(config, request);

    if (policy.state === DENY) { // auto deny
      return { block: true, reason: formatDenyReason(request, policy) };
    }
    if (policy.state === ALLOW) { // auto allow
      return undefined;
    }
    if (!ctx.hasUI) { // no ui, auto deny
      return { block: true, reason: formatNoUiReason(request, policy) };
    }

    // check session approval
    const sessionRequest =
      policy.source === "external"
        ? request
        : { ...request, externalDirectoryPath: undefined };
    const approval = findSessionApproval(
      state.approvals.getRules(),
      sessionRequest,
      policy.chainedBash,
    );
    if (approval) {return undefined;} // approved, proceed

    // generate the request message
    const summary = buildRequestSummary(request, policy);
    ctx.ui.setStatus(STATUS_KEY, STATUS_SUMMARIZING_REQUEST);
    let purpose: string | undefined;
    try {
      purpose = await generateRequestPurpose(ctx, request, summary);
    } finally {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }

    while (true) {
      const choice = await promptForPermission(ctx, summary, purpose);
      if (choice.kind === "once") { // approved, proceed
        return;
      }
      if (choice.kind === "reject") { // rejected
        return await rejectRequest(pi, ctx, request);
      }

      // "allow always"
      const rule = await chooseAlwaysRule(ctx, request, policy, summary);
      if (!rule) {
        // the user cancelled the wildcard editor, return to the permission dialog
        continue;
      }
      state.approvals.add(rule);
      return undefined;
    }
  });
}
