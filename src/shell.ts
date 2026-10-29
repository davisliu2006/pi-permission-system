/**
 * Conservative shell-chaining detector.
 *
 * This is not a shell parser. It is intentionally biased toward returning true
 * when the command contains syntax that can start another command or perform
 * command substitution.
 */
export function hasShellChaining(command: string): boolean {
  let quote: "'" | '"' | undefined;
  let index = 0;

  while (index < command.length) {
    const character = command[index]!;

    if (quote === "'") {
      if (character === "'") {quote = undefined;}
      index += 1;
      continue;
    }

    if (quote === '"') {
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === '"') {
        quote = undefined;
        index += 1;
        continue;
      }
      if (character === "`") {return true;}
      if (character === "$" && command[index + 1] === "(") {return true;}
      index += 1;
      continue;
    }

    if (character === "\\") {
      index += 2;
      continue;
    }

    if (character === "'") {
      quote = "'";
      index += 1;
      continue;
    }

    if (character === '"') {
      quote = '"';
      index += 1;
      continue;
    }

    if (character === "`") {return true;}
    if (character === "$" && command[index + 1] === "(") {return true;}
    if (character === ";" || character === "|" || character === "&") {return true;}
    if (character === "\n" || character === "\r") {return true;}
    if (character === "(" || character === ")") {return true;}

    index += 1;
  }

  // Unterminated quotes are unsafe to reason about.
  return quote !== undefined;
}
