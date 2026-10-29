/**
 * Strips comments from JSON.
 */
function stripComments(input: string): string {
  let output = "";
  let inString = false; // comments cannot exist in string
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (inString) {
      output += char;
      if (escaped) {escaped = false;}
      else if (char === "\\") {escaped = true;}
      else if (char === '"') {inString = false;}
    } else if (char === '"') {
      inString = true;
      output += char;
    } else if (char === "/" && input[i+1] === "/") { // single-line comment
      i += 2;
      while (i < input.length && input[i] !== "\n") {i++;}
      if (i < input.length) {output += "\n";}
    } else if (char === "/" && input[i+1] === "*") { // multi-line comment
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i+1] === "/")) {
        if (input[i] === "\n") {output += "\n";}
        i++;
      }
      i++;
    } else {
      output += char;
    }
  }

  return output;
}

/**
 * Strips extraneous trailing commas from JSON.
 */
function stripTrailingCommas(input: string): string {
  let output = "";
  let inString = false; // trailing comma cannot exist in string
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (inString) {
      output += char;
      if (escaped) {escaped = false;}
      else if (char === "\\") {escaped = true;}
      else if (char === '"') {inString = false;}
    } else if (char === '"') {
      inString = true;
      output += char;
    } else if (char === ",") {
      let lookahead = i+1;
      while (lookahead < input.length && /\s/.test(input[lookahead]!)) {lookahead++;}
      if (input[lookahead] === "}" || input[lookahead] === "]") {
        continue;
      }
      output += char;
    } else {
      output += char;
    }
  }

  return output;
}

/**
 * Convert JSONC to standard JSON.
 */
export function parseJsonc(input: string): unknown {
  const withoutComments = stripComments(input);
  const withoutTrailingCommas = stripTrailingCommas(withoutComments);
  return JSON.parse(withoutTrailingCommas);
}
