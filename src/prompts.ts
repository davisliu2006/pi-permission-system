import { describePolicy } from "./policy.ts";
import type { PermissionRequest, PolicyResolution } from "./types.ts";

const EXTERNAL_DIRECTORY_NOTE = "Outside the working directory.";

function preview(value: string, limit: number): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

/**
 * Describes the request subject to agent after blocked request.
 */
export function describeBlockedSubject(
  request: PermissionRequest,
  includeGenericSubject: boolean
): string {
  if (request.bodyKind === "command") {
    return `bash command ${JSON.stringify(request.body)}`;
  }
  if (request.bodyKind === "path") {
    return `${request.toolName} access to ${JSON.stringify(request.body)}`;
  }
  return includeGenericSubject
    ? `tool ${JSON.stringify(request.toolName)} with input ${request.body}`
    : `tool ${JSON.stringify(request.toolName)}`;
}

/**
 * Builds context for the "auto" permission classifier.
 */
export function buildClassifierPromptContext(request: PermissionRequest): string {
  const lines = [
    `Tool: ${request.toolName}`,
    `Working directory: ${request.cwd}`,
  ];

  if (request.bodyKind === "command") {
    lines.push(`Command:\n${preview(request.body, 600)}`);
  } else if (request.bodyKind === "path") {
    lines.push(`Path: ${preview(request.body, 400)}`);
  } else {
    lines.push(`Input: ${preview(request.body, 600)}`);
  }

  if (request.isExternalDirectory !== undefined) {
    lines.push(
      `Outside working directory: ${request.isExternalDirectory ? "yes" : "no"}`
    );
  }

  return lines.join("\n");
}

/**
 * Builds context for the ai-generated purpose.
 */
export function buildPurposePromptContext(request: PermissionRequest): string {
  const lines = [
    `Tool: ${request.toolName}`,
  ];

  if (request.bodyKind === "command") {
    lines.push(`Command:\n${preview(request.body, 600)}`);
  } else if (request.bodyKind === "path") {
    lines.push(`Path: ${preview(request.body, 400)}`);
    if (request.isExternalDirectory) {
      lines.push(EXTERNAL_DIRECTORY_NOTE);
    }
  } else {
    lines.push(`Input: ${preview(request.body, 600)}`);
  }

  return lines.join("\n");
}

export const CLASSIFIER_SYSTEM_PROMPT = [
  "You decide whether a coding-agent tool request can be auto-allowed.",
  "Reply with exactly one word, with no punctuation: \"allow\" or \"ask\".",
  "If uncertain, reply \"ask\".",
].join(" ");

export function buildClassifierInstructions(
  context: string,
  allowCriteria: string
): string {
  return [
    `A request can be \"allow\" if it meets this criteria: ${allowCriteria}.`,
    "",
    `Classify the following request:\n${context}`,
  ].join("\n");
}

export const PURPOSE_SYSTEM_PROMPT = [
  "You summarize the purpose of coding-agent tool requests for a permission prompt.",
  "Be as concise and neutral as possible.",
].join(" ");

export function buildPurposeInstructions(context: string): string {
  return [
    "Examples:",
    "Tool: bash",
    `Command: git commit -m "Add feature" && git log`,
    "Commits the changes to the repository and lists the commit history.",
    "Tool: bash",
    `Command: grep -rnEI --color=never --exclude-dir={node_modules} --include=\\*.py -B 2 -A 3 "^[[:space:]]*[^/]*\\b(func_1|func_2)\\s*(" .`,
    "Searches the project for instances of func_1 or func_2.",
    "",
    "Explain why the following request is being made in a single sentence.",
    "Do not use markdown or quotes.",
    "",
    `Request summary:\n${context}`,
  ].join("\n");
}

export const WILDCARD_SYSTEM_PROMPT = [
  "You generate shell command permission patterns for the user to approve.",
  "Return only the pattern itself with no explanation or markdown.",
].join(" ");

export const WILDCARD_LIST_SYSTEM_PROMPT = [
  "You generate shell command permission patterns for the user to approve.",
  "Return only semicolon-separated patterns with no explanation or markdown.",
].join(" ");

const WILDCARD_RULES = [
  "Rules for each pattern:",
  "- Use wildcard syntax, not regular expressions.",
  "- * matches any sequence of characters.",
  "- ? matches exactly one character.",
  "- \\* and \\? match literal characters.",
  "- All other characters are literal.",
];

export function buildWildcardInstructions(command: string): string {
  return [
    "Create a permission wildcard for this command.",
    "Select one that is general enough to be useful but narrow enough to not pose security risks.",
    "",
    ...WILDCARD_RULES,
    "The pattern must match the given command.",
    "",
    `Command: ${JSON.stringify(command)}`,
  ].join("\n");
}

export function buildWildcardListInstructions(commands: readonly string[]): string {
  return [
    "Create a permission wildcard for each command below.",
    "Select patterns that are general enough to be useful but narrow enough to not pose security risks.",
    "Return exactly one pattern per command, separated by semicolons, in the same order.",
    "",
    ...WILDCARD_RULES,
    "Each pattern must match its corresponding command.",
    "",
    `Commands: ${commands.join("; ")}`,
  ].join("\n");
}

/**
 * Prompt given to the agent on deny.
 */
export function formatDenyReason(request: PermissionRequest, policy: PolicyResolution): string {
  const subject = describeBlockedSubject(request, true);
  return `Permission denied for ${subject}. Policy: ${describePolicy(policy)}. Hard stop: do not retry or investigate a bypass. Report the denial to the user.`;
}

/**
 * Prompt given to the agent on no-UI deny.
 */
export function formatNoUiReason(request: PermissionRequest, policy: PolicyResolution): string {
  return `The ${request.toolName} request requires approval, but no interactive UI is available. Policy: ${describePolicy(policy)}.`;
}

/**
 * Prompt given to the agent on reject.
 */
export function formatRejectReason(request: PermissionRequest): string {
  const subject = describeBlockedSubject(request, false);
  return `User rejected ${subject}. Pause the task immediately (do not do further analysis or run more tool requests) and concisely ask the user what to do next.`;
}
