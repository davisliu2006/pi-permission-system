import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { toRecord } from "./types.ts";

const PATH_TOOLS = new Set(["read", "write", "edit", "grep", "find", "ls"]);

export interface ResolvedToolPath {
  absolute: string;
  permissionPath: string;
  outsideCwd: boolean;
}

/**
 * True if the string is one of the builtin path tools:
 * "read", "write", "edit", "grep", "find", or "ls".
 */
export function isPathTool(toolName: string): boolean {
  return PATH_TOOLS.has(toolName);
}

/**
 * Gets the tools path.
 */
export function extractRawToolPath(toolName: string, input: unknown): string | undefined {
  const record = toRecord(input);
  if (!record) {
    return isPathTool(toolName) ? "." : undefined;
  }

  const candidate =
    typeof(record.path) === "string"
      ? record.path
      : typeof(record.file_path) === "string"
        ? record.file_path
        : typeof(record.filePath) === "string"
          ? record.filePath
          : undefined;

  if (candidate && candidate.trim()) {return candidate;}
  return isPathTool(toolName) ? "." : undefined;
}

/**
 * Expands "~" to the home directory.
 */
export function expandHome(filePath: string): string {
  if (filePath === "~") {return homedir();}
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Normalizes the path to use '/' as a seperator.
 */
export function toPermissionPath(filePath: string): string {
  return filePath.split(sep).join("/");
}

/**
 * Normalizes path to be platform independent.
 * Note that Windows paths are case insensitive.
 */
export function normalizePathForComparison(filePath: string): string {
  const normalized = toPermissionPath(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/**
 * True if target is outside cwd.
 */
export function isPathOutside(cwd: string, target: string): boolean {
  const relativePath = relative(cwd, target);
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  );
}

/**
 * Gets the actual path of a path with a symlink.
 */
async function resolvePathWithSymlink(absolutePath: string): Promise<string> {
  let current = absolutePath;
  const missingSegments: string[] = [];

  while (true) {
    try {
      const resolved = await realpath(current);
      return missingSegments.length > 0 ? join(resolved, ...missingSegments.reverse()) : resolved;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return absolutePath;
      }
      missingSegments.push(current.slice(parent.length).replace(/^[\\/]+/, ""));
      current = parent;
    }
  }
}

/**
 * Returns a ResolvedToolPath from cwd and raw requested path.
 */
export async function resolveToolPath(
  cwd: string,
  rawPath: string,
): Promise<ResolvedToolPath> {
  const absolute = resolve(cwd, expandHome(rawPath));
  const resolvedAbsolute = await resolvePathWithSymlink(absolute);
  const resolvedCwd = await resolvePathWithSymlink(cwd);

  return {
    absolute: resolvedAbsolute,
    permissionPath: toPermissionPath(resolvedAbsolute),
    outsideCwd: isPathOutside(resolvedCwd, resolvedAbsolute),
  };
}
