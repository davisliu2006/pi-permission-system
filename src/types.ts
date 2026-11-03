import { ASK, PERMISSION_STATES } from "./constants.ts";
import type { ShellCommandAnalysis } from "./shell.ts";
import type { PiToolInput } from "./types-pi.ts";

// utility functions

export function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof(value) !== "object" || Array.isArray(value)) {return undefined;}
  return value as Record<string, unknown>;
}

// permission states

export type PermissionState = (typeof PERMISSION_STATES)[number];

export function toPermissionState(value: unknown): PermissionState | undefined {
  return PERMISSION_STATES.find((state) => state === value);
}

// permission config

export type PermissionSection = Record<string, PermissionState>;

export interface PermissionConfig {
  default: PermissionState;
  tools: PermissionSection;
  bash: PermissionSection;
  external_directory: PermissionSection;
}

export function createDefaultPermissionConfig(): PermissionConfig {
  return { default: ASK, tools: {}, bash: {}, external_directory: {} };
}

// permission request

export type RequestBodyKind = "path" | "command" | "generic";

/**
 * Request for a tool.
 * @property toolName - The name of the tool (eg. "bash").
 * @property input - The raw input to the tool.
 * @property body - The body for the permission request.
 * @property bodyKind - The meaning of the body.
 * @property cwd - The current working directory.
 * @property isExternalDirectory - Whether the request uses path to an external directory.
 * @property bashAnalysis - Shell scan for bash requests.
 */
export interface PermissionRequest {
  toolName: string;
  input: PiToolInput;
  body: string;
  bodyKind: RequestBodyKind;
  cwd: string;
  isExternalDirectory?: boolean;
  bashAnalysis?: ShellCommandAnalysis;
}

// resolved policy

export type PolicySource = "default" | "tool" | "bash" | "external";

/**
 * A resolved policy.
 */
export interface PolicyResolution {
  state: PermissionState;
  source: PolicySource;
  matchedPattern?: string;
}

export type AllowAlwaysMode = "wildcard" | "wildcard-list" | "exact";

// other types

export type AllowAlwaysRule = {
  kind: "exact";
  tool: string;
  body: string;
} | {
  kind: "wildcard";
  tool: "bash";
  body: string;
};

export interface PermissionDialogSelection {
  kind: "once" | "always" | "reject";
}

export interface ConfigWarning {
  message: string;
  path?: string;
}
