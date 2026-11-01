/**
 * Conservative shell-chaining detector.
 * This is not a parser and is biased toward returning true.
 * 
 * Guards against:
 * - Substitutions like `command` and $(command)
 * - Chaining like ;, &&, ||, \n, and \r
 * - Parentheses
 */
export function hasShellChaining(command: string): boolean {
  let quote: "'" | '"' | undefined;
  let index = 0;

  while (index < command.length) {
    const character = command[index]!;

    // inside quote
    if (quote === "'") {
      if (character === "'") {quote = undefined;}
      index++;
      continue;
    }
    if (quote === '"') {
      if (character === "\\") {
        index += 2;
        continue;
      }
      if (character === '"') {
        quote = undefined;
        index++;
        continue;
      }
      if (character === "`") {return true;}
      if (character === "$" && command[index + 1] === "(") {return true;}
      index++;
      continue;
    }

    // escape character
    if (character === "\\") {
      index += 2;
      continue;
    }
  
    // strat quote
    if (character === "'") {
      quote = "'";
      index++;
      continue;
    }
    if (character === '"') {
      quote = '"';
      index++;
      continue;
    }

    if (character === "`") {return true;}
    if (character === "$" && command[index + 1] === "(") {return true;}
    if (character === ";" || character === "|" || character === "&") {return true;}
    if (character === "\n" || character === "\r") {return true;}
    if (character === "(" || character === ")") {return true;}

    index++;
  }

  // Unterminated quotes are unsafe to reason about.
  return quote !== undefined;
}
