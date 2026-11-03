import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildRequest } from "../src/request-builder.ts";

const BUILTIN_PATH_TOOLS = ["read", "write", "edit", "grep", "find", "ls"];

test("external_directory marker is limited to built-in path tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-permissions-"));
  try {
    const project = join(root, "project");
    await mkdir(project);
    await writeFile(join(root, "outside.txt"), "outside");

    for (const toolName of BUILTIN_PATH_TOOLS) {
      const request = await buildRequest(toolName, { path: "../outside.txt" }, project);
      assert.equal(request.bodyKind, "path");
      assert.equal(
        request.isExternalDirectory,
        true,
        `${toolName} should mark outside paths for external_directory`
      );
    }

    const custom = await buildRequest("custom_fs", { path: "../outside.txt" }, project);
    assert.equal(custom.bodyKind, "generic");
    assert.equal(custom.body, JSON.stringify({ path: "../outside.txt" }));
    assert.equal(custom.isExternalDirectory, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external_directory marker is absent for paths inside the working directory", async () => {
  const request = await buildRequest("write", { path: "inside.txt" }, process.cwd());
  assert.equal(request.bodyKind, "path");
  assert.equal(request.isExternalDirectory, false);
});

test("generic tools use stable full-input JSON as the body", async () => {
  const request = await buildRequest(
    "mcp",
    { name: "search", z: 1, a: "two" },
    process.cwd()
  );
  assert.equal(request.bodyKind, "generic");
  assert.equal(request.body, JSON.stringify({ a: "two", name: "search", z: 1 }));
});

test("bash requests carry a single shell analysis", async () => {
  const simple = await buildRequest("bash", { command: "git status" }, process.cwd());
  assert.equal(simple.bodyKind, "command");
  assert.deepEqual(simple.bashAnalysis, {
    isComplex: false,
    segments: ["git status"],
  });

  const complex = await buildRequest("bash", { command: "git status | sh" }, process.cwd());
  assert.equal(complex.bashAnalysis?.isComplex, true);
  assert.deepEqual(complex.bashAnalysis?.segments, []);
});
