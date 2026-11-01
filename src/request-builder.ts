import { isPathTool, resolveToolPath } from "./paths.ts";
import { analyzeShellCommand } from "./shell.ts";
import type { PiToolInput } from "./types-pi.ts";
import { toRecord, type PermissionRequest } from "./types.ts";

/**
 * Recursively sorts object keys for stable serialization.
 */
function sortKeys(value: unknown): unknown {
  if (typeof(value) !== "object") {return value;}
  if (Array.isArray(value)) {return value.map(sortKeys);}
  const record = toRecord(value)!;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeys(record[key]);
  }
  return sorted;
}

/**
 * Stable JSON body for tools without a known subject shape.
 */
function serializeGenericBody(input: PiToolInput): string {
  try {
    return JSON.stringify(sortKeys(input)) ?? "{}";
  } catch {
    return "{}";
  }
}

/**
 * Builds the request object for the call.
 */
export async function buildRequest(
  toolName: string,
  input: PiToolInput,
  cwd: string
): Promise<PermissionRequest> {
  if (toolName === "bash") {
    const command =
      "command" in input && typeof(input.command) === "string" ? input.command : "";
    return {
      toolName,
      input,
      body: command,
      bodyKind: "command",
      cwd,
      isChainedBash: analyzeShellCommand(command).isComplex,
    };
  }

  if (isPathTool(toolName)) {
    const rawPath =
      "path" in input && typeof(input.path) === "string" ? input.path : ".";
    const resolved = await resolveToolPath(cwd, rawPath);
    return {
      toolName,
      input,
      body: resolved.permissionPath,
      bodyKind: "path",
      cwd,
      isExternalDirectory: resolved.outsideCwd,
    };
  }

  return {
    toolName,
    input,
    body: serializeGenericBody(input),
    bodyKind: "generic",
    cwd,
  };
}
