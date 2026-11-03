import {
  isMatchEverythingPattern,
  isValidWildcardPattern,
  matchesWildcard,
} from "./matcher.ts";
import {
  formatWildcardListCountReason,
  formatWildcardListItemReason,
  WILDCARD_LENGTH_REASON,
  WILDCARD_NO_MATCH_REASON,
} from "./warning-strings.ts";

export type WildcardValidationResult = {
  valid: true;
  broad: boolean;
} | {
  valid: false;
  reason: string;
};

export type WildcardListValidationResult = {
  valid: true;
  patterns: string[];
  broadPatterns: string[];
} | {
  valid: false;
  reason: string;
};

/**
 * Validates a wildcard pattern against a command.
 */
export function validateWildcardSuggestion(
  pattern: string,
  command: string
): WildcardValidationResult {
  if (!isValidWildcardPattern(pattern)) {
    return { valid: false, reason: WILDCARD_LENGTH_REASON };
  }
  if (!matchesWildcard(pattern, command)) {
    return { valid: false, reason: WILDCARD_NO_MATCH_REASON };
  }
  return { valid: true, broad: isMatchEverythingPattern(pattern) };
}

/**
 * Splits a semicolon-separated wildcard list from the model or editor.
 */
export function splitWildcardList(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Validates semicolon-separated patterns against a list of commands.
 */
export function validateWildcardSuggestionList(
  patternsText: string,
  commands: readonly string[]
): WildcardListValidationResult {
  const patterns = splitWildcardList(patternsText);
  if (patterns.length !== commands.length) {
    return {
      valid: false,
      reason: formatWildcardListCountReason(commands.length, patterns.length),
    };
  }

  const broadPatterns: string[] = [];
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index]!;
    const command = commands[index]!;
    const result = validateWildcardSuggestion(pattern, command);
    if (!result.valid) {
      return {
        valid: false,
        reason: formatWildcardListItemReason(index + 1, pattern, result.reason),
      };
    }
    if (result.broad) {broadPatterns.push(pattern);}
  }

  return { valid: true, patterns, broadPatterns };
}
