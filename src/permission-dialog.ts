import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { ExtensionSelectorComponent } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
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

function mapChoice(choice: string | undefined | null): PermissionDialogSelection {
  if (choice === ALLOW_ONCE) {return { kind: "once" };}
  if (choice === ALLOW_ALWAYS_EXACT || choice === ALLOW_ALWAYS_WILDCARD) {
    return { kind: "always" };
  }
  return { kind: "reject" };
}

/** Bold + color the `Label:` prefix; warning color for note lines. */
function styleSummaryLine(theme: Theme, line: string): string {
  const sep = line.indexOf(": ");
  if (sep === -1) {return theme.fg("text", line);}
  return theme.fg("accent", theme.bold(line.slice(0, sep + 1)))
    + theme.fg("text", line.slice(sep + 1));
}

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
  const options = [ALLOW_ONCE, formatAllowAlwaysOption(request, policy), REJECT];

  try {
    // non-tui mode fallback
    if (ctx.mode !== "tui") {
      const purposeLine = purpose ? `\n${PURPOSE_PREFIX}${purpose}` : "";
      const title = `${PERMISSION_DIALOG_TITLE}\n${summary}${purposeLine}\n${PERMISSION_DIALOG_QUESTION}`;
      return mapChoice(await ctx.ui.select(title, options));
    }

    // build custom tui
    const choice = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new Text(theme.fg("accent", theme.bold(PERMISSION_DIALOG_TITLE)), 1, 0));
      for (const line of summary.split("\n")) {
        container.addChild(new Text(styleSummaryLine(theme, line), 1, 0));
      }
      if (purpose) {
        container.addChild(new Text(styleSummaryLine(theme, `${PURPOSE_PREFIX}${purpose}`), 1, 0));
      }

      const selector = new ExtensionSelectorComponent(
        PERMISSION_DIALOG_QUESTION,
        options,
        (option) => done(option),
        () => done(null),
        { tui }
      );
      container.addChild(selector);

      return {
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          selector.handleInput(data);
          tui.requestRender();
        },
        dispose: () => selector.dispose(),
      };
    });

    return mapChoice(choice);
  } catch {
    return { kind: "reject" };
  }
}
