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
  let blocked=true,blockedRequests=0;
  const navigations:string[]=[];
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
  await page.route('**/office-check/assets/scene-*.js*',route=>{
    if(blocked){blockedRequests++;return route.abort();}return route.continue();
  });
  await installSnapshotRoute(page,populated(2));await page.goto('/office-check/');
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await page.getByLabel('Office style',{exact:true}).selectOption('precinct');
  await expect(page.getByText('3D office unavailable',{exact:true})).toBeVisible({timeout:20000});
  expect(blockedRequests).toBeGreaterThan(0);
  expect(navigations).toHaveLength(1);
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
  blocked=false;await page.getByRole('button',{name:'Retry 3D office',exact:true}).click();
  await expect(page.locator('.officeCanvas canvas')).toHaveAttribute('data-cast-ids',/Holt/,{timeout:20000});
  await expect(page.locator('.officeCanvas canvas')).toHaveCount(1);
  expect(navigations).toHaveLength(1);
  await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
});

test('production: module preloads leave recovery to their local boundary',async({page})=>{
  test.skip(process.env.OFFICE_PRODUCTION!=='1','Dedicated production-preview invocation');
  test.setTimeout(60000);
  await installSnapshotRoute(page,populated(2));
  const navigations:string[]=[];
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
  await page.goto('/office-check/');
  await expect(page.locator('.officeCanvas canvas')).toBeVisible({timeout:20000});
  const nextSnapshot=page.waitForResponse(response=>response.url().endsWith('/api/snapshot'));
  await page.evaluate(()=>{
    const preload=document.createElement('link');preload.rel='modulepreload';
    document.head.append(preload);preload.dispatchEvent(new Event('error'));preload.remove();
  });
  await nextSnapshot;
  expect(navigations).toHaveLength(1);
  expect(await page.evaluate(()=>sessionStorage.getItem('asset-reload'))).toBeNull();
});

for(const asset of ['script','stylesheet'] as const)test(`production: a failed startup ${asset} still reloads the document`,async({page})=>{
  test.skip(process.env.OFFICE_PRODUCTION!=='1','Dedicated production-preview invocation');
  test.setTimeout(60000);
  await installSnapshotRoute(page,populated(2));await page.goto('/office-check/');
  await expect(page.locator('.officeCanvas canvas')).toBeVisible({timeout:20000});
  const reload=page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame()});
  await page.evaluate(kind=>{
    const element=document.createElement(kind==='script'?'script':'link');
    if(element instanceof HTMLLinkElement)element.rel='stylesheet';
    document.head.append(element);element.dispatchEvent(new Event('error'));element.remove();
  },asset);
  await reload;await page.waitForLoadState('domcontentloaded');
  expect(Number(await page.evaluate(()=>sessionStorage.getItem('asset-reload')))).toBeGreaterThan(0);
  await expect(page.getByLabel('Office style',{exact:true})).toBeVisible({timeout:20000});
});
