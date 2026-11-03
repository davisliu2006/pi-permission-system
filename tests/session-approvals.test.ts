import assert from "node:assert/strict";
import test from "node:test";

import { SessionApprovalStore } from "../src/session-approvals.ts";

test("add ignores duplicate rules", () => {
  const store = new SessionApprovalStore();
  const exact = { kind: "exact" as const, tool: "bash", body: "git status" };
  const wildcard = { kind: "wildcard" as const, tool: "bash" as const, body: "git status*" };

  store.add(exact);
  store.add(exact);
  store.add(wildcard);
  store.add({ ...wildcard });

  assert.deepEqual(store.getRules(), [exact, wildcard]);
});

test("add keeps distinct rules that differ by kind, tool, or body", () => {
  const store = new SessionApprovalStore();
  store.add({ kind: "exact", tool: "bash", body: "git status" });
  store.add({ kind: "wildcard", tool: "bash", body: "git status" });
  store.add({ kind: "exact", tool: "write", body: "git status" });
  store.add({ kind: "exact", tool: "bash", body: "git log" });

  assert.equal(store.getRules().length, 4);
});

test("clear removes all rules", () => {
  const store = new SessionApprovalStore();
  store.add({ kind: "exact", tool: "bash", body: "git status" });
  store.clear();
  assert.deepEqual(store.getRules(), []);
});
