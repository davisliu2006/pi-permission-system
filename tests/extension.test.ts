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
      assert.ok(
        request.externalDirectoryPath,
        `${toolName} should mark outside paths for external_directory`,
      );
    }

    const custom = await buildRequest("custom_fs", { path: "../outside.txt" }, project);
    assert.equal(custom.bodyKind, "path");
    assert.equal(custom.body.endsWith("/outside.txt"), true);
    assert.equal(custom.externalDirectoryPath, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external_directory marker is absent for paths inside the working directory", async () => {
  const request = await buildRequest("write", { path: "inside.txt" }, process.cwd());
  assert.equal(request.bodyKind, "path");
  assert.equal(request.externalDirectoryPath, undefined);
});

test("tool input cwd does not change path resolution", async () => {
  const request = await buildRequest(
    "custom_fs",
    { path: "inside.txt", cwd: join(process.cwd(), "nested") },
    process.cwd(),
  );
  assert.equal(request.body.endsWith("/inside.txt"), true);
  assert.equal(request.body.includes("/nested/"), false);
});
