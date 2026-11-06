/**
 * Result of a conservative shell scan.
 *
 * When `isComplex` is false, `segments` are commands separated only by `;`,
 * `&&`, `||`, or newlines (or a single command).
 *
 * When `isComplex` is true because of `|` / `|&`, `segments` are still filled
 * so deny rules can be checked per stage. Other complex syntax returns empty
 * `segments`.
 */
export type ShellCommandAnalysis = {
  isComplex: boolean;
  segments: string[];
};

const COMPLEX: ShellCommandAnalysis = { isComplex: true, segments: [] };

/**
 * Conservative shell command scanner.
 * This is not a full parser and is biased toward `isComplex: true`.
 *
 * Splits on:
 * - `;`, `&&`, `||`, and newlines outside quotes
 * - '|' and '|&' outside quotes (also treated as complex)
 *
 * Treats as complex:
 * - Substitutions like `command` and $(command)
 * - Pipes `|` and background `&`
 * - Parentheses
 */
export function analyzeShellCommand(command: string): ShellCommandAnalysis {
  let quote: "'" | '"' | undefined;
  let index = 0;
  let current = "";
  let isComplex = false;
  const segments: string[] = [];

  const pushCurrent = (): void => {
    const trimmed = current.trim();
    if (trimmed) {segments.push(trimmed);}
    current = "";
  };

  while (index < command.length) {
    const character = command[index]!;

    // inside quote
    if (quote === "'") {
      if (character === "'") {quote = undefined;}
      current += character;
      index++;
      continue;
    }
    if (quote === '"') {
      if (character === "\\") {
        current += character + (command[index+1] ?? "");
        index += 2;
        continue;
      }
      if (character === '"') {
        quote = undefined;
        current += character;
        index++;
        continue;
      }
      if (character === "`") {return COMPLEX;}
      if (character === "$" && command[index+1] === "(") {return COMPLEX;}
      current += character;
      index++;
      continue;
    }

    // escape character
    if (character === "\\") {
      current += character + (command[index+1] ?? "");
      index += 2;
      continue;
    }

    // start quote
    if (character === "'") {
      quote = "'";
      current += character;
      index++;
      continue;
    }
    if (character === '"') {
      quote = '"';
      current += character;
      index++;
      continue;
    }

    if (character === "`") {return COMPLEX;}
    if (character === "$" && command[index+1] === "(") {return COMPLEX;}
    if (character === "(" || character === ")") {return COMPLEX;}

    // simple separators
    if (character === ";") {
      pushCurrent();
      index++;
      continue;
    }
    if (character === "&") {
      if (command[index+1] !== "&") {return COMPLEX;}
      pushCurrent();
      index += 2;
      continue;
    }
    if (character === "|") {
      pushCurrent();
      if (command[index+1] === "|") {
        index += 2;
        continue;
      }
      isComplex = true;
      index += command[index+1] === "&" ? 2 : 1;
      continue;
    }
    if (character === "\n" || character === "\r") {
      pushCurrent();
      if (character === "\r" && command[index+1] === "\n") {index += 2;}
      else {index++;}
      continue;
    }

    current += character;
    index++;
  }

  // Unterminated quotes are unsafe to reason about.
  if (quote !== undefined) {return COMPLEX;}

  pushCurrent();
  return {
    isComplex,
    segments: segments.length > 0 ? segments : [""],
  };
}
