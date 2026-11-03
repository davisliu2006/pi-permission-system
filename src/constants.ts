export const EXTENSION_NAME = "pi-permission-system";
export const STATUS_KEY = EXTENSION_NAME;
export const MAX_CONFIG_WARNINGS = 5;

export const CONFIG_FILENAME = "pi-permissions.jsonc";

export const ALLOW = "allow";
export const ASK = "ask";
export const DENY = "deny";
export const PERMISSION_STATES = [ALLOW, ASK, DENY] as const;
export const PERMISSION_STATES_DESCRIPTION = "allow, ask, or deny";

export const ALLOW_ONCE = "Allow Once";
export const ALLOW_ALWAYS_EXACT = "Allow Always (exact match)";
export const ALLOW_ALWAYS_WILDCARD = "Allow Always (generate wildcard)";
export const REJECT = "Reject";
