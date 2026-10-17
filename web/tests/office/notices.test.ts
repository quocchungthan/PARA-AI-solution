import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOfficeModel, deriveOfficeNotices } from "../../src/office/model";
import { populated, delegation } from "./fixtures";
test("health, human requests and failed relationships produce separate stable notices", () => {
  const snap = populated(2);
  snap.sessions[1].stale = true;
  snap.sessions[2].needs = [{ resolver: "human", text: "Choose" }];
  snap.delegations.push(
    delegation("failed", "main", "missing", "limit_reached"),
  );
  const m = deriveOfficeModel(snap),
    n = deriveOfficeNotices(m);
  assert.deepEqual(
    new Set(n.map((n) => n.kind)),
    new Set(["health", "human", "handoff"]),
  );
  assert.deepEqual(deriveOfficeNotices(m), n);
  assert.equal(n.filter((n) => n.kind === "human").length, 1);
});
