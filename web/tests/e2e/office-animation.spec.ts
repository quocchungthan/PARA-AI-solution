import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("animation: observed arrival once, immediate attention midwalk, theme and polls do not replay", async ({
  page,
}) => {
  test.setTimeout(60000);
  const api = await installSnapshotRoute(page, populated(0));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  api.setSnapshot(populated(1));
  const worker = page.locator(".officeActorLabel[data-kind=worker]");
  await expect(worker).toHaveAttribute("data-phase", "entering");
  const started = await worker.getAttribute("data-phase-start");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(worker).toHaveAttribute("data-phase-start", started!);
  const needs = populated(1);
  needs.sessions[1].state = "needs_human";
  needs.sessions[1].question = "Which design?";
  api.setSnapshot(needs);
  await expect(worker).toHaveAttribute("data-status", "needs-human");
  await expect(worker).toHaveAttribute("data-phase", "seated");
  await worker.click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Which design?");
  await expect(page.locator("[data-event-kind=arrive]")).toHaveCount(0);
});
test("animation: reduced motion seats arrivals immediately and idle leads use free lounge seats", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await installSnapshotRoute(page, populated(0));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator("[data-rest=lounge]")).toHaveCount(2);
  api.setSnapshot(populated(1));
  const w = page.locator(".officeActorLabel[data-kind=worker]");
  await expect(w).toHaveAttribute("data-motion", "reduced");
});
