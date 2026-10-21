import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
import {mkdir,writeFile} from 'node:fs/promises';
test("resources: each articulated character uses one instanced draw call", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(10));
  await page.goto("/");
  const canvas = page.locator(".officeCanvas canvas");
  await expect(canvas).toHaveAttribute("data-draw-calls", /^\d+$/, {
    timeout: 20000,
  });
  expect(Number(await canvas.getAttribute("data-draw-calls"))).toBeLessThan(30);
});
test("resources: stable office shadows are cached rather than redrawn for every limb", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(10));
  await page.goto("/");
  const canvas = page.locator(".officeCanvas canvas");
  await expect(canvas).toHaveAttribute("data-draw-calls", /^\d+$/, {
    timeout: 20000,
  });
  expect(Number(await canvas.getAttribute("data-draw-calls"))).toBeLessThan(
    100,
  );
});
test("resources: geometry is shared across the full voxel cast", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(10));
  await page.goto("/");
  const canvas = page.locator(".officeCanvas canvas");
  await expect(canvas).toHaveAttribute("data-geometries", /^\d+$/, {
    timeout: 20000,
  });
  expect(Number(await canvas.getAttribute("data-geometries"))).toBeLessThan(10);
});
test('resources: twenty precinct visits retain one canvas, source selection and stable geometry',async({page})=>{
  test.setTimeout(180000);
  await page.emulateMedia({reducedMotion:'reduce'});
  const snap=populated(10),api=await installSnapshotRoute(page,snap);await page.goto('/');
  const canvas=page.locator('.officeCanvas canvas'),selector=page.getByLabel('Office style',{exact:true});
  await expect(canvas).toHaveAttribute('data-style','botanical',{timeout:20000});
  const original=await canvas.elementHandle();
  await selector.selectOption('botanical');
  await expect(page.getByRole('button',{name:'Home view',exact:true})).toBeEnabled();
  await page.locator('.officeSession').filter({hasText:'Task worker-0'}).click();
  await page.evaluate(()=>{
    const ids=new Set<string>();
    new MutationObserver(()=>{document.querySelectorAll('[data-event-kind="report"]').forEach(e=>ids.add((e as HTMLElement).dataset.eventId!));(window as unknown as {officeReportIds:string[]}).officeReportIds=[...ids];}).observe(document.body,{subtree:true,childList:true,attributes:true});
  });
  snap.delegations[0].status='result_fed';api.setSnapshot(structuredClone(snap));
  await expect(page.locator('[data-event-kind="report"]')).toHaveCount(1);
  const eventId=await page.locator('[data-event-kind="report"]').getAttribute('data-event-id');
  let warm:{geometries:number;textures:number}|undefined;
  let precinctZoom=0;const measurements:unknown[]=[];
  for(let i=1;i<=20;i++) {
    await selector.selectOption('precinct');await expect(canvas).toHaveAttribute('data-cast-ids',/Holt/);
    await expect(page.getByRole('button',{name:'Reverse view',exact:true})).toBeEnabled();
    if(i===1){await page.getByRole('button',{name:'Focus Captain’s office',exact:true}).click();precinctZoom=JSON.parse((await page.locator('.officeSceneRegion').getAttribute('data-pose'))!).zoom;}
    const pose=JSON.parse((await page.locator('.officeSceneRegion').getAttribute('data-pose'))!);
    expect(pose.target).toEqual([27.7,1,14]);expect(pose.zoom).toBeCloseTo(precinctZoom,5);
    await expect(page.locator('.officeActorLabel[data-kind="worker"]')).toHaveCount(10);
    await expect(page.getByRole('complementary',{name:'Office observation'})).toContainText('Task worker-0');
    await expect(canvas).toHaveCount(1);
    if(i===2||i===20) {
      await page.waitForTimeout(150);
      const metrics=await canvas.evaluate(c=>({geometries:Number((c as HTMLElement).dataset.geometries),textures:Number((c as HTMLElement).dataset.textures)}));
      measurements.push({visit:i,...metrics});
      if(i===2)warm=metrics;else expect(metrics).toEqual(warm);
    }
    if(i%5===0)await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
    if(i<20){await selector.selectOption('botanical');await expect(canvas).toHaveAttribute('data-cast-ids','[]');}
  }
  expect(await original!.evaluate(node=>node.isConnected)).toBe(true);
  await expect(selector).toHaveValue('precinct');
  await expect(page.locator('.officeCameraControls select')).toHaveCount(1);
  expect(await page.evaluate(()=>(window as unknown as {officeReportIds:string[]}).officeReportIds)).toEqual([eventId]);
  await mkdir('test-results/office-evidence',{recursive:true});
  await writeFile('test-results/office-evidence/resource-switching.json',JSON.stringify({visits:20,measurements,canvasRetained:true,workers:10,sourceReports:1},null,2));
});
