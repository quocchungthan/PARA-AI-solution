import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("release: idle pantry, actual walking, selected-worker and fallback evidence", async ({
  page,
}) => {
  test.setTimeout(60000);
  const api = await installSnapshotRoute(page, populated(0));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await page.locator(".splash").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Focus Pantry / lounge", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/office-evidence/pantry-idle.png",
  });
  await page.getByRole("button", { name: "Home view", exact: true }).click();
  api.setSnapshot(populated(1));
  const worker = page.locator(".officeActorLabel[data-kind=worker]");
  await expect(worker).toHaveAttribute("data-phase", "entering");
  const transform = await worker.evaluate((el) => el.style.transform);
  await expect
    .poll(() => worker.evaluate((el) => el.style.transform))
    .not.toBe(transform);
  const fullWidth = await page.locator(".officeCanvas canvas").evaluate(
    (c) => (c as HTMLCanvasElement).width,
  );
  await page
    .getByLabel("Office roster")
    .getByRole("button", { name: /Worker Task worker-0/ })
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
  await page.screenshot({
    path: "test-results/office-evidence/selected-worker.png",
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/office-evidence/selected-worker-dark.png",
  });
  await page
    .locator(".officeCanvas canvas")
    .dispatchEvent("webglcontextlost", { cancelable: true });
  await expect(page.getByText("3D office unavailable")).toBeVisible();
  await page.screenshot({
    path: "test-results/office-evidence/rendering-fallback.png",
  });
});
