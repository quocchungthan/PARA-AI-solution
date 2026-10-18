import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
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
