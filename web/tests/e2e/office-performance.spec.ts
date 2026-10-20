import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated, session } from "../office/fixtures";
for(const styleId of ['botanical','precinct'] as const)for(const [width,height] of [[1440,900],[390,844]])test(`performance: ${styleId} ${width}px maximum population measured for 30 seconds`, async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width,height});
  const snap = populated(10);
  snap.sessions.push(
    session("second", "coordinator", "needs_human", {
      title: "Another conversation",
      question: "Choose a plan",
    }),
  );
  const api = await installSnapshotRoute(page, snap);
  await page.goto("/");
  if(width<900)await page.getByRole("button",{name:"Show 3D office",exact:true}).click();
  if(styleId==='precinct')await page.getByLabel("Office style",{exact:true}).selectOption(styleId);
  const canvas = page.locator(".officeCanvas canvas");
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(canvas).toHaveAttribute("data-draw-calls", /^\d+$/);
  await page.locator(".splash").waitFor({ state: "detached" });
  await page.waitForTimeout(1500);
  const renderStart=Number(await canvas.getAttribute("data-render-count"));
  const measuring = page.evaluate(
    () =>
      new Promise<{
        frames: number;
        meanMs: number;
        p95Ms: number;
        fps: number;
        elapsedMs: number;
      }>((resolve) => {
        const samples: number[] = [];
        const start = performance.now();
        let last = start;
        function frame(now: number) {
          samples.push(now - last);
          last = now;
          if (now - start < 30000) requestAnimationFrame(frame);
          else {
            samples.sort((a, b) => a - b);
            const meanMs = samples.reduce((a, b) => a + b, 0) / samples.length;
            resolve({
              frames: samples.length,
              elapsedMs: now-start,
              meanMs,
              p95Ms: samples[Math.floor(samples.length * 0.95)],
              fps: 1000 / meanMs,
            });
          }
        }
        requestAnimationFrame(frame);
      }),
  );
  const rect = await canvas.boundingBox();
  await page.mouse.move(
    rect!.x + rect!.width * 0.5,
    rect!.y + rect!.height * 0.6,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect!.x + rect!.width * 0.6,
    rect!.y + rect!.height * 0.65,
    { steps: 15 },
  );
  await page.mouse.up();
  await page.mouse.wheel(0, -100);
  const changed = structuredClone(snap);
  changed.delegations[0].status = "result_fed";
  api.setSnapshot(changed);
  await page.getByRole("button", { name: "Home view", exact: true }).click();
  const timing = await measuring;
  const metadata = await canvas.evaluate((c) => {
    const gl = (c as HTMLCanvasElement).getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      userAgent: navigator.userAgent,
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      renderDpr:c.getAttribute("data-render-dpr"),
      buffer:[(c as HTMLCanvasElement).width,(c as HTMLCanvasElement).height],
      completedRenders:Number(c.getAttribute("data-render-count")),
      renderer: ext
        ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "unavailable",
      drawCalls: c.getAttribute("data-draw-calls"),
      triangles: c.getAttribute("data-triangles"),
      geometries: c.getAttribute("data-geometries"),
      textures: c.getAttribute("data-textures"),
    };
  });
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.waitForTimeout(500);const idleStart=Number(await canvas.getAttribute("data-render-count"));
  await page.waitForTimeout(700);const idleAdditionalRenders=Number(await canvas.getAttribute("data-render-count"))-idleStart;
  await mkdir("test-results/office-evidence", {
    recursive: true,
  });
  await writeFile(
    `test-results/office-evidence/performance-${styleId}-${width}-${process.env.OFFICE_GPU_PROFILE==='1'?'gpu':'software'}.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        durationSeconds: 30,
        characters: 18,styleId,profile:process.env.OFFICE_GPU_PROFILE==='1'?'gpu-requested':'swiftshader',
        renderedFrames:metadata.completedRenders-renderStart,renderedFps:(metadata.completedRenders-renderStart)*1000/timing.elapsedMs,idleAdditionalRenders,
        ...timing,
        ...metadata,
      },
      null,
      2,
    ),
  );
  expect(timing.frames).toBeGreaterThan(0);
  expect(Number(metadata.drawCalls)).toBeGreaterThan(0);
});
