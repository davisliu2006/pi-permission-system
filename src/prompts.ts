export const PURPOSE_SYSTEM_PROMPT =
  "You summarize coding-agent tool requests for a permission prompt. Be concise and neutral. Never make the permission decision.";

export const PURPOSE_INSTRUCTIONS = [
  "Explain why the following coding-agent request is being made.",
  "Return one short sentence of at most 140 characters.",
  "Describe the intent, not whether it should be allowed or denied.",
  "Do not use markdown, quotes, or a preamble.",
] as const;

export const WILDCARD_SYSTEM_PROMPT =
  "You generate conservative shell-command permission patterns. Return only the pattern. Never allow a broader command set than necessary.";

export const WILDCARD_INSTRUCTIONS = [
  "Create a permission wildcard for this bash command.",
  "Return only the pattern itself, with no markdown, quotes, or explanation.",
  "",
  "Rules for the pattern:",
  "- Use wildcard syntax, never regular expressions.",
  "- * matches any sequence of characters.",
  "- ? matches exactly one character.",
  "- \\* and \\? match literal wildcard characters.",
  "- All other characters are literal.",
  "- Do not add anchors, delimiters, groups, or alternation.",
  "- The pattern must match the entire command.",
  "- Prefer a specific pattern. Do not use *, **, or an equivalent match-everything pattern.",
] as const;
