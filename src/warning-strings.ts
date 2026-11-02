import { EXTENSION_NAME, PERMISSION_STATES_DESCRIPTION } from "./constants.ts";

export const CONFIG_WARNING_PREFIX = `${EXTENSION_NAME}: `;
export const INVALID_WILDCARD_PREFIX = "Invalid wildcard: ";

export const CONFIG_MUST_BE_OBJECT =
  "Permission config must be a JSON object; using defaults.";
export const IGNORED_DEFAULT_WARNING =
  `Ignoring "default": expected ${PERMISSION_STATES_DESCRIPTION}.`;

export const WILDCARD_LENGTH_REASON =
  "Pattern must be between 1 and 500 characters.";
export const WILDCARD_NO_MATCH_REASON =
  "Pattern does not match the current command.";

export function formatIgnoredSectionWarning(sectionName: string): string {
  return `Ignoring "${sectionName}": expected an object mapping names to ${PERMISSION_STATES_DESCRIPTION}.`;
}

export function formatIgnoredSectionEntryWarning(
  sectionName: string,
  key: string
): string {
  return `Ignoring "${sectionName}.${key}": expected ${PERMISSION_STATES_DESCRIPTION}.`;
}

export function formatConfigReadFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Failed to read permission config: ${detail}`;
}

export function formatConfigParseFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Failed to parse permission config: ${detail}`;
}

export function formatSuppressedConfigWarnings(suppressed: number): string {
  return `${suppressed} additional config warning(s) suppressed.`;
}

export function formatWildcardListCountReason(
  expected: number,
  actual: number
): string {
  return `Expected ${expected} semicolon-separated pattern(s), got ${actual}.`;
}

export function formatWildcardListItemReason(
  index: number,
  pattern: string,
  reason: string
): string {
  return `Pattern ${index} (${JSON.stringify(pattern)}): ${reason}`;
}
