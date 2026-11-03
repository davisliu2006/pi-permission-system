import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  ALLOW_ALWAYS_EXACT,
  ALLOW_ALWAYS_WILDCARD,
  ALLOW_ONCE,
  REJECT,
} from "./constants.ts";
import type {
  PermissionDialogSelection,
  PermissionRequest,
  PolicyResolution,
} from "./types.ts";
import {
  formatAllowAlwaysOption,
  PERMISSION_DIALOG_QUESTION,
  PERMISSION_DIALOG_TITLE,
  PURPOSE_PREFIX,
} from "./ui-strings.ts";

/**
 * Shows permission dialog and gets input.
 */
export async function promptForPermission(
  ctx: ExtensionContext,
  request: PermissionRequest,
  policy: PolicyResolution,
  summary: string,
  purpose?: string
): Promise<PermissionDialogSelection> {
  const purposeLine = purpose ? `\n${PURPOSE_PREFIX}${purpose}` : "";
  const title = `${PERMISSION_DIALOG_TITLE}\n${summary}${purposeLine}\n${PERMISSION_DIALOG_QUESTION}`;
  const options = [ALLOW_ONCE, formatAllowAlwaysOption(request, policy), REJECT];

  let choice: string | undefined;
  try {
    choice = await ctx.ui.select(title, options);
  } catch {
    return { kind: "reject" };
  }

  if (choice === ALLOW_ONCE) {return { kind: "once" };}
  if (choice === ALLOW_ALWAYS_EXACT || choice === ALLOW_ALWAYS_WILDCARD) {
    return { kind: "always" };
  }
  return { kind: "reject" };
}
