import assert from "node:assert/strict";
import test from "node:test";

import { hasShellChaining } from "../src/shell.ts";

test("detects shell chaining operators", () => {
  for (const command of [
    "git status; rm -rf /",
    "git status && rm -rf /",
    "git status || rm -rf /",
    "git status | sh",
    "git status &",
    "git status\nrm -rf /",
    "git status\r\nrm -rf /",
    "(git status)",
    "git status $(rm -rf /)",
    "git status `rm -rf /`",
    "git status <(rm -rf /)",
  ]) {
    assert.equal(hasShellChaining(command), true, command);
  }
});

test("simple commands are not chained", () => {
  for (const command of [
    "git status",
    "git status --short",
    "echo 'a; b'",
    'echo "a && b"',
    "echo a\\;b",
    "echo a\\&\\&b",
    "echo '$(rm -rf /)'",
  ]) {
    assert.equal(hasShellChaining(command), false, command);
  }
});

test("command substitution inside double quotes is chained", () => {
  assert.equal(hasShellChaining('echo "$(rm -rf /)"'), true);
  assert.equal(hasShellChaining('echo "`rm -rf /`"'), true);
});

test("unterminated quotes are treated as unsafe", () => {
  assert.equal(hasShellChaining("echo 'unterminated"), true);
  assert.equal(hasShellChaining('echo "unterminated'), true);
});
