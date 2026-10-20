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
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/);
  await page.reload();
  await expect(page.getByLabel('Office style',{exact:true})).toHaveValue('precinct');
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/);
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => n.includes("/assets/")),
  );
  expect(
    assets.some((n) => n.includes("/office-check/assets/OfficeCanvas-")),
  ).toBe(true);
  expect(assets.some(n=>n.includes('/office-check/assets/scene-'))).toBe(true);
  expect(failed).toEqual([]);
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(
    page.getByText("Orchestration network", { exact: true }),
  ).toBeVisible();
});
test('production: a failed precinct chunk retries under the configured base',async({page})=>{
  test.skip(process.env.OFFICE_PRODUCTION!=='1','Dedicated production-preview invocation');
  test.setTimeout(60000);
  let blocked=true;
  await page.route('**/office-check/assets/scene-*.js*',route=>blocked?route.abort():route.continue());
  await installSnapshotRoute(page,populated(2));await page.goto('/office-check/');
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.getByText('3D office unavailable',{exact:true})).toBeVisible();
  blocked=false;await page.getByRole('button',{name:'Retry 3D office',exact:true}).click();
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  await expect(page.locator('.officeCanvas canvas')).toHaveCount(1);
});
