import {
  isMatchEverythingPattern,
  isValidWildcardPattern,
  matchesWildcard,
} from "./matcher.ts";

/**
 * Validates a wildcard pattern against a command.
 */
export function validateWildcardSuggestion(
  pattern: string,
  command: string
): { valid: true; broad: boolean } | { valid: false; reason: string } {
  if (!isValidWildcardPattern(pattern)) {
    return { valid: false, reason: "Pattern must be between 1 and 500 characters." };
  }
  if (!matchesWildcard(pattern, command)) {
    return { valid: false, reason: "Pattern does not match the current command." };
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
export function validateWildcardSuggestions(
  patternsText: string,
  commands: readonly string[]
): { valid: true; patterns: string[]; broadPatterns: string[] } | { valid: false; reason: string } {
  const patterns = splitWildcardList(patternsText);
  if (patterns.length !== commands.length) {
    return {
      valid: false,
      reason: `Expected ${commands.length} semicolon-separated pattern(s), got ${patterns.length}.`,
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
        reason: `Pattern ${index + 1} (${JSON.stringify(pattern)}): ${result.reason}`,
      };
    }
    if (result.broad) {broadPatterns.push(pattern);}
  }

  return { valid: true, patterns, broadPatterns };
}
