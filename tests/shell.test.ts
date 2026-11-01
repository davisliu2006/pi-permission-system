import assert from "node:assert/strict";
import test from "node:test";

import { analyzeShellCommand, hasShellChaining } from "../src/shell.ts";

test("detects complex shell syntax", () => {
  for (const command of [
    "git status | sh",
    "git status &",
    "(git status)",
    "git status $(rm -rf /)",
    "git status `rm -rf /`",
    "git status <(rm -rf /)",
  ]) {
    assert.equal(hasShellChaining(command), true, command);
    assert.equal(analyzeShellCommand(command).isComplex, true, command);
  }
});

test("simple commands and list sequences are not complex", () => {
  for (const command of [
    "git status",
    "git status --short",
    "echo 'a; b'",
    'echo "a && b"',
    "echo a\\;b",
    "echo a\\&\\&b",
    "echo '$(rm -rf /)'",
    "git status; git log",
    "git status && git log",
    "git status || git log",
    "git status\ngit log",
    "git status\r\ngit log",
  ]) {
    assert.equal(hasShellChaining(command), false, command);
    assert.equal(analyzeShellCommand(command).isComplex, false, command);
  }
});

test("splits simple sequences on list separators and newlines", () => {
  assert.deepEqual(analyzeShellCommand("git status; git log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("git status;"), {
    isComplex: false,
    segments: ["git status"],
  });
  assert.deepEqual(analyzeShellCommand("git status;; git log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("git status && git log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("git status || git log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("git status && git log || git show"), {
    isComplex: false,
    segments: ["git status", "git log", "git show"],
  });
  assert.deepEqual(analyzeShellCommand("git status\ngit log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("git status\r\ngit log"), {
    isComplex: false,
    segments: ["git status", "git log"],
  });
  assert.deepEqual(analyzeShellCommand("echo 'a; b'; git status"), {
    isComplex: false,
    segments: ["echo 'a; b'", "git status"],
  });
});

test("command substitution inside double quotes is complex", () => {
  assert.equal(hasShellChaining('echo "$(rm -rf /)"'), true);
  assert.equal(hasShellChaining('echo "`rm -rf /`"'), true);
});

test("unterminated quotes are treated as complex", () => {
  assert.equal(hasShellChaining("echo 'unterminated"), true);
  assert.equal(hasShellChaining('echo "unterminated'), true);
});
