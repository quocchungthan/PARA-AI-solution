import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("production: lazy 3D assets load below a non-root deployment path", async ({
  page,
}) => {
  test.skip(
    process.env.OFFICE_PRODUCTION !== "1",
    "Dedicated production-preview invocation",
  );
  await installSnapshotRoute(page, populated(10));
  const failed: string[] = [];
  page.on("requestfailed", (r) => {
    if (r.url().includes("/assets/")) failed.push(r.url());
  });
  await page.goto("/office-check/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".officeActorLabel[data-kind=worker]")).toHaveCount(
    10,
  );
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => n.includes("/assets/")),
  );
  expect(
    assets.some((n) => n.includes("/office-check/assets/OfficeCanvas-")),
  ).toBe(true);
  expect(failed).toEqual([]);
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(
    page.getByText("Orchestration network", { exact: true }),
  ).toBeVisible();
});
