import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  ALLOW_ALWAYS,
  ALLOW_ONCE,
  MAX_DIALOG_TITLE_LENGTH,
  PERMISSION_DIALOG_QUESTION,
  PERMISSION_DIALOG_TITLE,
  PERMISSION_OPTIONS,
  PURPOSE_LABEL,
} from "./constants.ts";
import type { PermissionDialogSelection } from "./types.ts";

function truncateTitle(title: string, limit = MAX_DIALOG_TITLE_LENGTH): string {
  return title.length > limit ? `${title.slice(0, limit)}...` : title;
}

/**
 * Shows permission dialog and gets input.
 */
export async function promptForPermission(
  ctx: ExtensionContext,
  summary: string,
  purpose?: string,
): Promise<PermissionDialogSelection> {
  // if there's no ui, just reject
  if (!ctx.hasUI) {return { kind: "reject" };}

  const purposeLine = purpose ? `\n\n${PURPOSE_LABEL}: ${purpose}` : "";
  const title = truncateTitle(
    `${PERMISSION_DIALOG_TITLE}\n\n${summary}${purposeLine}\n\n${PERMISSION_DIALOG_QUESTION}`,
  );

  let choice: string | undefined;
  try {
    choice = await ctx.ui.select(title, [...PERMISSION_OPTIONS]);
  } catch {
    return { kind: "reject" };
  }

  if (choice === ALLOW_ONCE) {return { kind: "once" };}
  if (choice === ALLOW_ALWAYS) {return { kind: "always" };}
  return { kind: "reject" };
}
