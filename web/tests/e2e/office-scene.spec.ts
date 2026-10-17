import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test.setTimeout(60000);
test.use({ actionTimeout: 20000 });
test("scene: visual evidence", async ({ page }) => {
  await installSnapshotRoute(page, populated(0));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 30000,
  });
  await page.locator(".splash").waitFor({ state: "detached" });
  for (const width of [1440, 1366]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await page.getByRole("button", { name: "Home view", exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `../docs/superpowers/verification/assets/agent-office/static-light-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `../docs/superpowers/verification/assets/agent-office/static-dark-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Toggle theme" }).click();
  }
});
test("scene: real canvas, Home, focus, theme preserves camera", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(0));
  await page.goto("/");
  const scene = page.getByLabel("3D office", { exact: true });
  await expect(scene.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Focus Research", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-camera", /research/);
  const camera = await scene.getAttribute("data-pose");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(scene).toHaveAttribute("data-pose", camera!);
  await page.getByRole("button", { name: "Home view", exact: true }).click();
  await expect(scene).toHaveAttribute("data-camera", "home");
});
test("scene: renderer failure retains observation and graph", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: any,
      ...args: any[]
    ) {
      if (String(type).includes("webgl")) return null;
      return original.apply(this, [type, ...args] as any);
    } as any;
  });
  await installSnapshotRoute(page, populated(1));
  await page.goto("/");
  await expect(page.getByText("3D office unavailable")).toBeVisible();
  await page.getByRole("button", { name: /Worker Task worker-0/ }).click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(
    page.getByText("Orchestration network", { exact: true }),
  ).toBeVisible();
});
