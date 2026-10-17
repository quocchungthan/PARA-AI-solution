import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("camera: opening details from Home keeps the whole floor framed", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(1));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Home view", exact: true }).click();
  const fullWidth = await page.locator(".officeCanvas canvas").evaluate(
    (c) => (c as HTMLCanvasElement).width,
  );
  await page
    .getByRole("button", { name: "Engineering lead", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator(".officeCanvas canvas")
        .evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeLessThan(fullWidth);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect
    .poll(async () => {
      const region = await page
        .getByLabel("3D office", { exact: true })
        .boundingBox();
      const label = await page
        .getByRole("button", { name: "Room Research", exact: true })
        .boundingBox();
      return (
        !!region &&
        !!label &&
        label.x >= region.x &&
        label.x + label.width <= region.x + region.width
      );
    })
    .toBe(true);
});
