import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  expandHome,
  isPathOutside,
  resolveToolPath,
  toPermissionPath,
} from "../src/paths.ts";

test("expandHome resolves ~ and ~/ prefixes", () => {
  const home = homedir();
  assert.equal(expandHome("~"), home);
  assert.equal(expandHome("~/docs"), join(home, "docs"));
  assert.equal(expandHome("~\\docs"), join(home, "docs"));
  assert.equal(expandHome("/tmp/file"), "/tmp/file");
  assert.equal(expandHome("~user"), "~user");
});

test("resolves inside and outside paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-permissions-"));
  try {
    const project = join(root, "project");
    await mkdir(project);
    await writeFile(join(project, "inside.txt"), "hello");
    const outside = join(root, "outside.txt");
    await writeFile(outside, "outside");

    const insideResult = await resolveToolPath(project, "inside.txt");
    assert.equal(insideResult.outsideCwd, false);
    assert.equal(toPermissionPath(insideResult.absolute), insideResult.permissionPath);

    const outsideResult = await resolveToolPath(project, "../outside.txt");
    assert.equal(outsideResult.outsideCwd, true);
    assert.equal(outsideResult.permissionPath, toPermissionPath(outside));

    const missingResult = await resolveToolPath(project, "new-dir/new-file.txt");
    assert.equal(missingResult.outsideCwd, false);
    assert.equal(missingResult.permissionPath.endsWith("/new-dir/new-file.txt"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("relative containment does not treat sibling prefixes as inside", () => {
  assert.equal(isPathOutside("/project", "/project/file.txt"), false);
  assert.equal(isPathOutside("/project", "/project-other/file.txt"), true);
  assert.equal(isPathOutside("/project", "/project/../outside.txt"), true);
});
