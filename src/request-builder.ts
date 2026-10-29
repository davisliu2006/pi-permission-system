import { GENERIC_BODY_KEYS, MCP_FALLBACK_TARGET } from "./constants.ts";
import { extractRawToolPath, isPathTool, resolveToolPath } from "./paths.ts";
import { hasShellChaining } from "./shell.ts";
import { toRecord, type PermissionRequest } from "./types.ts";

/**
 * Derive the body for the MCP tool.
 */
function deriveMcpTarget(input: Record<string, unknown>): string {
  if (typeof(input.tool) === "string" && input.tool.trim()) {return input.tool;}
  if (typeof(input.server) === "string" && typeof(input.name) === "string") {
    return `${input.server}:${input.name}`;
  }
  if (typeof(input.target) === "string" && input.target.trim()) {return input.target;}
  if (typeof(input.name) === "string" && input.name.trim()) {return input.name;}
  return MCP_FALLBACK_TARGET;
}

/**
 * Derive the body for a generic tool.
 */
function deriveGenericBody(toolName: string, input: unknown): string {
  const record = toRecord(input);
  if (!record) {return toolName;}
  for (const key of GENERIC_BODY_KEYS) {
    const value = record[key];
    if (typeof(value) === "string" && value.trim()) {return value;}
  }
  return toolName;
}

/**
 * Builds the request object for the call.
 */
export async function buildRequest(
  toolName: string,
  input: unknown,
  cwd: string,
): Promise<PermissionRequest> {
  if (toolName === "bash") {
    const record = toRecord(input);
    const command = record && typeof(record.command) === "string" ? record.command : "";
    return {
      toolName,
      input,
      body: command,
      bodyKind: "command",
      cwd,
      chainedBash: hasShellChaining(command),
    };
  }

  const rawPath = extractRawToolPath(toolName, input);
  if (rawPath !== undefined) {
    const resolved = await resolveToolPath(cwd, rawPath);
    // only built-in path tools feed the external_directory guard
    const externalDirectoryPath =
      isPathTool(toolName) && resolved.outsideCwd ? resolved.permissionPath : undefined;
    return {
      toolName,
      input,
      body: resolved.permissionPath,
      bodyKind: "path",
      cwd,
      normalizedPath: resolved.permissionPath,
      externalDirectoryPath,
    };
  }

  if (toolName === "mcp") {
    const record = toRecord(input);
    const target = record ? deriveMcpTarget(record) : MCP_FALLBACK_TARGET;
    return { toolName, input, body: target, bodyKind: "target", cwd };
  }

  return {
    toolName,
    input,
    body: deriveGenericBody(toolName, input),
    bodyKind: "tool",
    cwd,
  };
}
