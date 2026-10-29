import { ASK, PERMISSION_STATES } from "./constants.ts";

export type PermissionState = (typeof PERMISSION_STATES)[number];

export function toPermissionState(value: unknown): PermissionState | undefined {
  return PERMISSION_STATES.find((state) => state === value);
}

export function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof(value) !== "object" || Array.isArray(value)) {return undefined;}
  return value as Record<string, unknown>;
}

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

export const DEFAULT_PERMISSION_CONFIG = createDefaultPermissionConfig();

export type RequestBodyKind = "command" | "path" | "target" | "tool";

/**
 * Request for a tool.
 * @property toolName - The name of the tool (eg. "bash").
 * @property input - The raw input to the tool.
 * @property body - The body for the permission request.
 * @property bodyKind - The meaning of the body.
 * @property cwd - The current working directory.
 */
export interface PermissionRequest {
  toolName: string;
  input: unknown;
  body: string;
  bodyKind: RequestBodyKind;
  cwd: string;
  normalizedPath?: string;
  externalDirectoryPath?: string;
  chainedBash?: boolean;
}

export type PolicySource = "bash" | "tool" | "default" | "external";

/**
 * A resolved policy.
 */
export interface PolicyResolution {
  state: PermissionState;
  source: PolicySource;
  matchedPattern?: string;
  chainedBash: boolean;
}

export type AllowAlwaysRule =
  | { scope: "tool"; tool: string; kind: "exact"; body: string }
  | { scope: "tool"; tool: "bash"; kind: "wildcard"; pattern: string }
  | { scope: "external_directory"; tool: string; kind: "exact"; body: string };

export interface PermissionDialogSelection {
  kind: "once" | "always" | "reject";
}

export interface ConfigWarning {
  message: string;
  path?: string;
}
