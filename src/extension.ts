import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

import { clearPurposeCache, generateRequestPurpose } from "./ai-purpose.ts";
import { clearWildcardCache } from "./matcher.ts";
import {
  ALLOW,
  CONFIG_FILENAME,
  DENY,
  MAX_CONFIG_WARNINGS,
  STATUS_KEY,
} from "./constants.ts";
import { loadMergedConfig } from "./config.ts";
import { promptForPermission } from "./permission-dialog.ts";
import { findSessionApproval, resolvePolicy } from "./policy.ts";
import {
  buildPurposePromptContext,
  formatDenyReason,
  formatNoUiReason,
  formatRejectReason,
} from "./prompts.ts";
import { buildRequest } from "./request-builder.ts";
import { SessionApprovalStore } from "./session-approvals.ts";
import {
  buildSelectorSummary,
  STATUS_SUMMARIZING_REQUEST,
} from "./ui-strings.ts";
import {
  CONFIG_WARNING_PREFIX,
  formatSuppressedConfigWarnings,
} from "./warning-strings.ts";
import { chooseAlwaysRules } from "./wildcard-editor.ts";
import type { PermissionConfig } from "./types.ts";

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
    join(ctx.cwd, CONFIG_FILENAME)
  );

  if (ctx.hasUI) {
    for (const warning of warnings.slice(0, MAX_CONFIG_WARNINGS)) {
      ctx.ui.notify(`${CONFIG_WARNING_PREFIX}${warning.message}`, "warning");
    }
    if (warnings.length > MAX_CONFIG_WARNINGS) {
      const suppressed = warnings.length - MAX_CONFIG_WARNINGS;
      ctx.ui.notify(
        `${CONFIG_WARNING_PREFIX}${formatSuppressedConfigWarnings(suppressed)}`,
        "warning"
      );
    }
  }

  return config;
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
    clearWildcardCache();
    state.config = undefined;
    state.configCwd = undefined;
    state.config = await ensureConfig(ctx);
  });

  // session end
  pi.on("session_shutdown", () => {
    state.approvals.clear();
    clearPurposeCache();
    clearWildcardCache();
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
    const approval = findSessionApproval(state.approvals.getRules(), request);
    if (approval) {return undefined;} // approved, proceed

    const summary = buildSelectorSummary(request);
    ctx.ui.setStatus(STATUS_KEY, STATUS_SUMMARIZING_REQUEST);
    let purpose: string | undefined;
    try {
      purpose = await generateRequestPurpose(
        ctx,
        request,
        buildPurposePromptContext(request, policy)
      );
    } finally {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }

    while (true) {
      const choice = await promptForPermission(ctx, request, policy, summary, purpose);
      if (choice.kind === "once") { // approved, proceed
        return;
      }
      if (choice.kind === "reject") { // rejected
        return { block: true, reason: formatRejectReason(request) };
      }

      // "allow always"
      const rules = await chooseAlwaysRules(ctx, request, policy);
      if (!rules) {
        // the user cancelled the wildcard editor, return to the permission dialog
        continue;
      }
      for (const rule of rules) {
        state.approvals.add(rule);
      }
      return undefined;
    }
  });
}
