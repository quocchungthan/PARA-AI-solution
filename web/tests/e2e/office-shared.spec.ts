import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installSnapshotRoute } from "./snapshotRoute";
import { multiConversation, populated, session, snapshot, delegation } from "../office/fixtures";

test.setTimeout(60000);

test("shared: all sessions and coordinator summaries are available without floor selection", async ({ page }) => {
  await installSnapshotRoute(page, multiConversation());
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel("Conversation floor")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Completed", exact: true })).toHaveCount(0);
  await expect(page.locator(".officeSession")).toHaveCount(8);
  await expect(page.locator('.officeActorLabel[data-kind="worker"]')).toHaveCount(7);
  await page.getByRole("button", { name: "Executive assistant", exact: true }).click();
  const details = page.getByRole("complementary", { name: "Office observation" });
  await expect(details).toContainText("Department representative");
  for (const id of ["a", "b", "nested"]) await expect(details.getByRole("button", { name: `Task ${id}`, exact: true })).toBeVisible();
  for (const id of ["standalone", "custom", "unassigned", "history"]) {
    await page.locator(".officeSession").filter({ hasText: `Task ${id}` }).click();
    await expect(details).toContainText(`Task ${id}`);
    if (id === "custom") await expect(details).not.toContainText("Unverified source");
  }
});

test("shared: empty office and disappearing selected records preserve the scene", async ({ page }) => {
  const api = await installSnapshotRoute(page, snapshot([], [], { roles: ["designer"] }));
  await page.goto("/");
  const canvas = page.locator(".officeCanvas canvas");
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".officeActorLabel")).toHaveCount(9);
  await expect(page.getByText("No sessions yet.", { exact: true })).toBeVisible();
  const handle = await canvas.elementHandle();
  api.setSnapshot(snapshot([session("human"), session("assistant", "coordinator")], [delegation("missing", "absent-a", "absent-b", "failed")]));
  await expect(page.locator('.officeActorLabel[data-kind="worker"]')).toHaveCount(2);
  await expect(page.getByLabel("Office attention")).toContainText("absent-a");
  await expect(page.getByLabel("Office attention").getByRole("button", { name: /^Handoff failed/ })).toHaveCount(0);
  await page.locator('.officeSession').filter({ hasText: "Task assistant" }).click();
  const details = page.getByRole("complementary", { name: "Office observation" });
  await expect(details).toContainText("Task assistant");
  api.setSnapshot(snapshot());
  await expect(details).toContainText("Session unavailable");
  expect(await handle!.evaluate(node => node.isConnected)).toBe(true);
  await expect(canvas).toHaveCount(1);
});

test("shared: canvas keeps the reclaimed control space and Office/Graph log placement", async ({ page }, info) => {
  await installSnapshotRoute(page, populated(10));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({ timeout: 20000 });
  await page.locator(".splash").waitFor({ state: "detached" });
  const measurements = [];
  for (const [width, height] of [[1440, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Home view", exact: true }).click();
    const office = await page.locator(".orchestrationPanel").boundingBox();
    const scene = await page.locator(".officeSceneRegion").boundingBox();
    const roster = await page.locator(".officeRoster").boundingBox();
    const panel = await page.locator(".officePanel").boundingBox();
    const summary = await page.locator(".officeSummary").boundingBox();
    const notices = await page.locator(".officeNotices").boundingBox();
    expect(scene!.height).toBeGreaterThanOrEqual(panel!.height - summary!.height - roster!.height - (notices?.height ?? 0) - 2);
    expect(Math.abs(scene!.y + scene!.height - roster!.y)).toBeLessThanOrEqual(1);
    const controls = await page.locator(".officeFloors").count() ? await page.locator(".officeFloors").boundingBox() : null;
    const logs = await page.locator(".console").boundingBox();
    expect(logs!.y).toBeGreaterThanOrEqual(office!.y + office!.height);
    expect(roster!.height).toBeLessThanOrEqual(190);
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    const graph = await page.locator(".orchestrationPanel").boundingBox();
    const graphLogs = await page.locator(".console").boundingBox();
    expect(graphLogs!.x).toBeGreaterThanOrEqual(graph!.x + graph!.width);
    measurements.push({ width, height, office, scene, roster, controls, logs, graph, graphLogs });
    await page.getByRole("button", { name: "Office", exact: true }).click();
    await expect(page.locator(".officeCanvas canvas")).toBeVisible();
  }
  await writeFile(info.outputPath("shared-layout.json"), JSON.stringify(measurements, null, 2));
  await expect(page.getByLabel("Conversation floor")).toHaveCount(0);
});

test("shared: overflow reveal and departure refill stay within ten workers", async ({ page }) => {
  const snap = snapshot(Array.from({ length: 12 }, (_, i) => session(`task-${String(i).padStart(2, "0")}`)));
  const api = await installSnapshotRoute(page, snap);
  await page.goto("/");
  const workers = page.locator('.officeActorLabel[data-kind="worker"]');
  await expect(workers).toHaveCount(10, { timeout: 20000 });
  await expect(page.locator(".officeActorLabel")).toHaveCount(19);
  await expect(page.locator(".officeSession")).toHaveCount(12);
  await expect(page.locator(".officeSessionList > summary")).toContainText("12 live · 10 in 3D · 2 list only");
  await page.locator(".officeSession").filter({ hasText: "Task task-10" }).click();
  await expect(workers).toHaveCount(10);
  await expect(page.locator('.officeActorLabel[data-kind="worker"][data-identity="task-10"]')).toHaveCount(1);
  await expect(page.locator("[data-event-kind=arrive]")).toHaveCount(0);
  snap.sessions.find(s => s.sessionId === "task-10")!.state = "done";
  api.setSnapshot(structuredClone(snap));
  await expect(page.locator('.officeActorLabel[data-kind="worker"][data-identity="task-10"]')).toHaveCount(0, { timeout: 25000 });
  await expect(workers).toHaveCount(10);
  await expect(page.locator(".officeSessionList > summary")).toContainText("11 live · 10 in 3D · 1 list only");
});
