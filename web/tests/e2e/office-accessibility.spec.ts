import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("accessibility: Escape and close restore focus; existing drawer closes office observation", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(1));
  await page.goto("/");
  const invoker = page.getByRole("button", {
    name: "Engineering lead",
    exact: true,
  });
  await invoker.focus();
  await page.keyboard.press("Enter");
  const details = page.getByRole("complementary", {
    name: "Office observation",
  });
  await expect(details).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(invoker).toBeFocused();
  await invoker.click();
  await page.getByRole("button", { name: "Close observation" }).click();
  await expect(invoker).toBeFocused();
  await invoker.click();
  await page.evaluate(() => (location.hash = "session=worker-0"));
  await expect(details).toHaveCount(0);
  await expect(page.locator(".drawer")).toBeVisible();
});
test("accessibility: compact office is opt-in and all layouts avoid horizontal overflow", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(10));
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Office", exact: true }),
    ).toBeVisible();
    if (width < 900) {
      await expect(page.locator(".officeCanvas canvas")).toHaveCount(0);
      await page.getByRole("button", { name: "Show 3D office" }).click();
      await expect(page.locator(".officeCanvas canvas")).toBeVisible({
        timeout: 20000,
      });
      await expect
        .poll(
          async () =>
            (await page.locator(".officeCanvas canvas").boundingBox())
              ?.height ?? 0,
        )
        .toBeGreaterThan(200);
      await page.screenshot({
        path: "../docs/superpowers/verification/assets/agent-office/compact.png",
        fullPage: true,
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("accessibility: graphics context loss and retry preserve session details and logs", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(1));
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await page
    .getByLabel("Office roster")
    .getByRole("button", { name: /Worker Task worker-0/ })
    .click();
  await page
    .locator(".officeCanvas canvas")
    .dispatchEvent("webglcontextlost", { cancelable: true });
  await expect(page.getByText("3D office unavailable")).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Task worker-0");
  await expect(
    page.getByRole("region", { name: "Logs", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry 3D office" }).click();
  await expect(page.locator(".officeCanvas canvas")).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Task worker-0");
});
test("accessibility: lazy renderer failure is local and can be retried", async ({
  page,
}) => {
  let blocked = true;
  await page.route("**/src/office/scene/OfficeCanvas.tsx*", async (route) => {
    if (blocked) await route.abort();
    else await route.continue();
  });
  await installSnapshotRoute(page, populated(1));
  await page.goto("/");
  await expect(page.getByText("3D office unavailable")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("Office roster")).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Retry 3D office" }).click();
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await page.screenshot({
    path: "../docs/superpowers/verification/assets/agent-office/renderer-retry.png",
  });
});
