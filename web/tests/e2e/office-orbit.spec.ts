import { test, expect, type Page } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated, session } from "../office/fixtures";
import type { CameraPose } from "../../src/office/types";

test.setTimeout(60000);

async function pose(page: Page): Promise<CameraPose> {
  const region = page.getByLabel("3D office", { exact: true });
  await expect(region).toHaveAttribute("data-pose", /position/);
  return JSON.parse(
    (await region.getAttribute("data-pose"))!,
  );
}
function offset(p: CameraPose) {
  return p.position.map((v, i) => v - p.target[i]);
}
function azimuth(p: CameraPose) {
  const [x, , z] = offset(p);
  return Math.atan2(x, z);
}
function polar(p: CameraPose) {
  const [x, y, z] = offset(p);
  return Math.acos(y / Math.hypot(x, y, z));
}
function angleDelta(a: CameraPose, b: CameraPose) {
  return Math.atan2(Math.sin(azimuth(b) - azimuth(a)), Math.cos(azimuth(b) - azimuth(a)));
}
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".officeCanvas canvas")).toBeVisible({ timeout: 20000 });
  await page.locator(".splash").waitFor({ state: "detached" });
  await expect(page.getByLabel("3D office", { exact: true })).toHaveAttribute("data-pose", /position/);
}
async function drag(page: Page, dx: number, dy = 0, button: "left" | "right" = "left", shift = false) {
  const r = (await page.locator(".officeCanvas canvas").boundingBox())!;
  const before = await page.getByLabel("3D office", { exact: true }).getAttribute("data-pose");
  const x = r.x + r.width * 0.4, y = r.y + r.height * 0.7;
  await page.mouse.move(x, y);
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.down({ button });
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up({ button });
  if (shift) await page.keyboard.up("Shift");
  await expect.poll(() => page.getByLabel("3D office", { exact: true }).getAttribute("data-pose")).not.toBe(before);
  return pose(page);
}

test("orbit: passes a full horizontal revolution, stays above the floor, and Home resets", async ({ page }) => {
  await installSnapshotRoute(page, populated(1));
  await ready(page);
  const home = await pose(page);
  const r = (await page.locator(".officeCanvas canvas").boundingBox())!;
  let previous = home, rotation = 0;
  for (let i = 0; i < 5; i++) {
    const current = await drag(page, r.height / 4);
    const turn = angleDelta(previous, current);
    expect(Math.abs(turn)).toBeGreaterThan(1);
    rotation += turn;
    expect(current.target).toEqual(home.target);
    expect(current.zoom).toBeCloseTo(home.zoom, 6);
    previous = current;
  }
  expect(Math.abs(rotation)).toBeGreaterThan(Math.PI * 2 + 0.5);
  await page.screenshot({ path: "test-results/office-evidence/orbit-360.png" });
  for (const dy of [-r.height / 3, r.height / 3]) {
    const tilted = await drag(page, 0, dy);
    expect(polar(tilted)).toBeGreaterThan(0);
    expect(polar(tilted)).toBeLessThan(Math.PI / 2);
    expect(tilted.position[1]).toBeGreaterThan(tilted.target[1]);
  }
  await expect(page.getByRole("complementary", { name: "Office observation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Home view", exact: true }).click();
  const reset = await pose(page);
  reset.position.forEach((v, i) => expect(v).toBeCloseTo(home.position[i], 6));
  expect(reset.target).toEqual(home.target);
  expect(reset.zoom).toBeCloseTo(home.zoom, 6);
});

test("orbit: pan and zoom keep orientation; room focus and floor/view changes retain the chosen angle", async ({ page }) => {
  const snap = populated(1);
  snap.sessions.push(session("second", "coordinator", "working", { title: "Second floor" }));
  await installSnapshotRoute(page, snap);
  await ready(page);
  const home = await pose(page);
  const orbited = await drag(page, 90, -20);
  expect(Math.abs(angleDelta(home, orbited))).toBeGreaterThan(0.5);
  const panned = await drag(page, 40, 15, "right");
  expect(panned.target).not.toEqual(orbited.target);
  offset(panned).forEach((v, i) => expect(v).toBeCloseTo(offset(orbited)[i], 6));
  const shifted = await drag(page, -30, -10, "left", true);
  expect(shifted.target).not.toEqual(panned.target);
  offset(shifted).forEach((v, i) => expect(v).toBeCloseTo(offset(panned)[i], 6));
  await page.mouse.wheel(0, -150);
  await expect.poll(async () => (await pose(page)).zoom).toBeGreaterThan(shifted.zoom);
  await page.getByRole("button", { name: "Focus Research", exact: true }).click();
  const focused = await pose(page);
  expect(focused.target).toEqual([-11.5, 0, -6.5]);
  offset(focused).forEach((v, i) => expect(v).toBeCloseTo(offset(shifted)[i], 6));
  await page.getByRole("button", { name: "Toggle theme" }).click();
  expect(await pose(page)).toEqual(focused);
  const fullWidth = await page.locator(".officeCanvas canvas").evaluate(c => c.clientWidth);
  await page.getByRole("button", { name: "Engineering lead", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Office observation" })).toBeVisible();
  await expect.poll(() => page.locator(".officeCanvas canvas").evaluate(c => c.clientWidth)).toBeLessThan(fullWidth);
  const resized = await pose(page);
  expect(polar(resized)).toBeCloseTo(polar(focused), 6);
  expect(azimuth(resized)).toBeCloseTo(azimuth(focused), 6);
  await page.getByRole("button", { name: "Close observation" }).click();
  await page.getByLabel("Conversation floor").selectOption("second");
  await expect.poll(async () => azimuth(await pose(page))).toBeCloseTo(azimuth(home), 6);
  await drag(page, -70);
  await page.getByLabel("Conversation floor").selectOption("main");
  await expect.poll(async () => azimuth(await pose(page))).toBeCloseTo(azimuth(focused), 6);
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page.locator(".officeCanvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Office", exact: true }).click();
  await expect(page.locator(".officeCanvas canvas")).toBeVisible();
  await expect.poll(async () => azimuth(await pose(page))).toBeCloseTo(azimuth(focused), 6);
});

test.describe("touch orbit", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("one finger orbits; two fingers pan and pinch without selecting an actor", async ({ page }) => {
    await installSnapshotRoute(page, populated(0));
    await page.goto("/");
    await page.locator('.splash').waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Show 3D office" }).click();
    await expect(page.locator(".officeCanvas canvas")).toBeVisible({ timeout: 20000 });
    const r = (await page.locator(".officeCanvas canvas").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const x = r.x + r.width / 2, y = r.y + r.height * 0.65;
    const home = await pose(page);
    await send("touchStart", [{ id: 1, x: x - 40, y }]);
    for (let i = 1; i <= 5; i++) await send("touchMove", [{ id: 1, x: x - 40 + i * 16, y }]);
    await send("touchEnd", []);
    await expect.poll(async () => Math.abs(angleDelta(home, await pose(page)))).toBeGreaterThan(0.5);
    const rotated = await pose(page);
    await send("touchStart", [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }]);
    for (let i = 1; i <= 5; i++) await send("touchMove", [{ id: 1, x: x - 35 + i * 5, y: y + i * 2 }, { id: 2, x: x + 35 + i * 5, y: y + i * 2 }]);
    await send("touchEnd", []);
    await expect.poll(async () => (await pose(page)).target).not.toEqual(rotated.target);
    const panned = await pose(page);
    expect(azimuth(panned)).toBeCloseTo(azimuth(rotated), 6);
    await send("touchStart", [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }]);
    for (let i = 1; i <= 5; i++) await send("touchMove", [{ id: 1, x: x - 35 - i * 5, y }, { id: 2, x: x + 35 + i * 5, y }]);
    await send("touchEnd", []);
    await expect.poll(async () => (await pose(page)).zoom).toBeGreaterThan(panned.zoom);
    expect(azimuth(await pose(page))).toBeCloseTo(azimuth(rotated), 6);
    await expect(page.getByRole("complementary", { name: "Office observation" })).toHaveCount(0);
    await cdp.detach();
  });
});
