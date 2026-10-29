export const EXTENSION_NAME = "pi-permission-system";
export const STATUS_KEY = EXTENSION_NAME;
export const CONFIG_WARNING_PREFIX = `${EXTENSION_NAME}: `;
export const MAX_CONFIG_WARNINGS = 5;

export const CONFIG_FILENAME = "pi-permissions.jsonc";

export const ALLOW = "allow";
export const ASK = "ask";
export const DENY = "deny";
export const PERMISSION_STATES = [ALLOW, ASK, DENY] as const;
export const PERMISSION_STATES_DESCRIPTION = "allow, ask, or deny";

export const STATUS_SUMMARIZING_REQUEST = "Summarizing permission request...";
export const STATUS_GENERATING_WILDCARD = "Generating bash wildcard...";

export const ALLOW_ONCE = "Allow Once";
export const ALLOW_ALWAYS = "Allow Always";
export const REJECT = "Reject";
export const PERMISSION_OPTIONS = [ALLOW_ONCE, ALLOW_ALWAYS, REJECT] as const;

export const PERMISSION_DIALOG_TITLE = "Permission required";
export const PERMISSION_DIALOG_QUESTION = "What should the agent be allowed to do?";
export const PURPOSE_LABEL = "Purpose";
export const MAX_DIALOG_TITLE_LENGTH = 4000;

export const WILDCARD_EDITOR_TITLE = "Review bash wildcard";
export const BROAD_WILDCARD_TITLE = "Very broad wildcard";
export const INVALID_WILDCARD_PREFIX = "Invalid wildcard: ";

export const REJECT_NEXT_STEP = "Stop the current task and ask the user what to do next.";
export const REJECT_DO_NOT_RETRY = "Do not retry the rejected request.";
export const REJECT_FOLLOW_UP_MESSAGE = `The user rejected a tool request. ${REJECT_NEXT_STEP}`;

export const CHAINED_BASH_NOTE = "Shell chaining detected: bash pattern rules were skipped.";
export const EXTERNAL_DIRECTORY_NOTE = "Outside the working directory.";

export const MCP_FALLBACK_TARGET = "mcp";
export const GENERIC_BODY_KEYS = ["target", "command", "path", "file_path", "name", "url"] as const;
