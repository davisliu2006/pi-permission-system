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

export interface PermissionSettings {
  /** `provider/model-id` override for small helper completions. */
  ai_model?: string;
}

export interface PermissionConfig {
  default: PermissionState;
  tools: PermissionSection;
  bash: PermissionSection;
  external_directory: PermissionSection;
  settings: PermissionSettings;
}

export function createDefaultPermissionConfig(): PermissionConfig {
  return { default: ASK, tools: {}, bash: {}, external_directory: {}, settings: {} };
}

/**
 * Parses `provider/model-id`.
 * Splits using the first '/'.
 */
export function parseAiModelRef(
  value: string
): { provider: string; modelId: string } | undefined {
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash >= trimmed.length - 1) {return undefined;}
  const provider = trimmed.slice(0, slash).trim();
  const modelId = trimmed.slice(slash + 1).trim();
  if (!provider || !modelId) {return undefined;}
  return { provider, modelId };
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
