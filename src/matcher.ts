import type { PermissionState } from "./types.ts";

const MAX_PATTERN_LENGTH = 500; // guard cache size
const NEVER_MATCH = /$^/;

export interface WildcardMatch {
  pattern: string;
  state: PermissionState;
}

export interface WildcardOptions {
  caseInsensitive?: boolean;
}

/**
 * Cache for the compileWildcard function.
 */
const cache = new Map<string, RegExp>();

/**
 * If the character is a special regex character, prepend '\'.
 */
function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

/**
 * Converts wildcard to regex.
 */
export function compileWildcard(pattern: string, options: WildcardOptions = {}): RegExp {
  const isCaseInsensitive = options.caseInsensitive === true;
  const cacheKey = `${isCaseInsensitive ? "i" : "s"}\u0000${pattern}`;
  const cached = cache.get(cacheKey);
  if (cached) {return cached;}

  if (pattern.length > MAX_PATTERN_LENGTH) {
    cache.set(cacheKey, NEVER_MATCH);
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

  const flags = isCaseInsensitive ? "si" : "s";
  const compiled = new RegExp(`^${regexSource}$`, flags);
  cache.set(cacheKey, compiled);
  return compiled;
}

/**
 * True if the string matches wildcard.
 */
export function matchesWildcard(pattern: string, str: string, options: WildcardOptions = {}): boolean {
  return compileWildcard(pattern, options).test(str);
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
 * True if the wildcard has '*' or '?'.
 */
export function hasUnescapedWildcard(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") {
      i++;
    } else if (char === "*" || char === "?") {
      return true;
    }
  }
  return false;
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
