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
  command: string,
): { valid: true; broad: boolean } | { valid: false; reason: string } {
  if (!isValidWildcardPattern(pattern)) {
    return { valid: false, reason: "Pattern must be between 1 and 500 characters." };
  }
  if (!matchesWildcard(pattern, command)) {
    return { valid: false, reason: "Pattern does not match the current command." };
  }
  return { valid: true, broad: isMatchEverythingPattern(pattern) };
}
