import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated, session, delegation } from "../office/fixtures";
test("attention: other floors wait for click; health and failed handoffs stay distinct", async ({
  page,
}) => {
  const snap = populated(1);
  snap.sessions.push(
    session("second", "coordinator", "done", { title: "Second floor" }),
  );
  const api = await installSnapshotRoute(page, snap);
  await page.goto("/");
  await expect(page.getByLabel("Conversation floor")).toHaveValue("main");
  await page
    .getByRole("button", { name: "Focus Research", exact: true })
    .click();
  const pose = await page
    .getByLabel("3D office", { exact: true })
    .getAttribute("data-pose");
  snap.sessions.push(
    session("question", "reviewer", "needs_human", {
      question: "Can we use this design?",
    }),
  );
  snap.delegations.push(delegation("sq", "second", "question"));
  snap.sessions[1].stale = true;
  snap.delegations.push(delegation("fail", "main", "missing", "failed"));
  api.setSnapshot(structuredClone(snap));
  const notices = page.getByLabel("Floor attention");
  await expect(
    notices.getByRole("button", { name: /^Needs you · Second floor/ }),
  ).toBeVisible();
  await expect(
    notices.getByRole("button", { name: /^Health ·/ }),
  ).toBeVisible();
  await expect(
    notices.getByRole("button", { name: /^Handoff failed ·/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Conversation floor")).toHaveValue("main");
  await expect(page.getByLabel("3D office", { exact: true })).toHaveAttribute(
    "data-pose",
    pose!,
  );
  await notices
    .getByRole("button", { name: /^Needs you · Second floor/ })
    .click();
  await expect(page.getByLabel("Conversation floor")).toHaveValue("second");
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Can we use this design?");
  await page.screenshot({
    path: "../docs/superpowers/verification/assets/agent-office/other-floor-attention.png",
  });
});
test("reconnect: selection and camera survive outage, no arrival backlog or duplicate polling", async ({
  page,
}) => {
  test.setTimeout(60000);
  const snap = populated(1);
  const api = await installSnapshotRoute(page, snap);
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/snapshot")) requests++;
  });
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Focus Research", exact: true })
    .click();
  await page
    .getByLabel("Office roster")
    .getByRole("button", { name: /Worker Task worker-0/ })
    .click();
  const before = await page
    .getByLabel("3D office", { exact: true })
    .getAttribute("data-pose");
  api.failSnapshotRequests(true);
  await expect(
    page.getByText(
      "Start it on your machine. This page reconnects on its own.",
    ),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(11000);
  api.setSnapshot(populated(2));
  api.failSnapshotRequests(false);
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Task worker-0", { timeout: 15000 });
  await expect(page.getByLabel("3D office", { exact: true })).toHaveAttribute(
    "data-pose",
    before!,
  );
  await expect(page.locator("[data-phase=entering]")).toHaveCount(0);
  await expect(page.locator(".officeCanvas canvas")).toHaveCount(1);
  expect(requests).toBeLessThan(16);
});
