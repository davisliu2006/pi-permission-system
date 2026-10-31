import type { PermissionState } from "./types.ts";

const MAX_PATTERN_LENGTH = 500; // guard cache size
const NEVER_MATCH = /$^/;

export interface WildcardMatch {
  pattern: string;
  state: PermissionState;
}

/**
 * Cache for the compileWildcard function.
 */
const cache = new Map<string, RegExp>();

/**
 * Clears the compiled wildcard cache.
 */
export function clearWildcardCache(): void {
  cache.clear();
}

/**
 * If the character is a special regex character, prepend '\'.
 */
function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

/**
 * Converts wildcard to regex.
 */
function compileWildcard(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) {return cached;}

  if (pattern.length > MAX_PATTERN_LENGTH) {
    cache.set(pattern, NEVER_MATCH);
    return NEVER_MATCH;
  }

  let regexSource = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") { // escape
      const next = pattern[i+1];
      if (next === "*" || next === "?") {
        regexSource += `\\${next}`;
        i++;
      } else {
        regexSource += "\\\\";
      }
    } else if (char === "*") {
      regexSource += ".*";
    } else if (char === "?") {
      regexSource += ".";
    } else {
      regexSource += escapeRegexChar(char);
    }
  }

  const compiled = new RegExp(`^${regexSource}$`, "s");
  cache.set(pattern, compiled);
  return compiled;
}

/**
 * True if the string matches wildcard.
 */
export function matchesWildcard(pattern: string, str: string): boolean {
  return compileWildcard(pattern).test(str);
}

/**
 * Finds the last wildcard match in a list of rules.
 */
export function findLastWildcardMatch(
  rules: Record<string, PermissionState>,
  str: string,
): WildcardMatch | undefined {
  const entries = Object.entries(rules);
  for (let i = entries.length - 1; i >= 0; i--) {
    const [pattern, state] = entries[i]!;
    if (matchesWildcard(pattern, str)) {
      return { pattern, state };
    }
  }
  return undefined;
}

/**
 * True if the pattern is equivalent to "*".
 */
export function isMatchEverythingPattern(pattern: string): boolean {
  if (!pattern) {return false;}
  let sawStar = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") {
      const next = pattern[i+1];
      if (next === "*" || next === "?") {
        return false;
      }
      i++;
    } else if (char === "*") {
      sawStar = true;
    } else if (char !== "?") {
      return false;
    }
  }
  return sawStar;
}

export function isValidWildcardPattern(pattern: string): boolean {
  return pattern.length > 0 && pattern.length <= MAX_PATTERN_LENGTH;
}
