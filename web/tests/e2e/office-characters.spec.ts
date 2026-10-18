import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated } from "../office/fixtures";
test("characters: stable lead identities, unknown workers, drag protection and maximum-population evidence", async ({
  page,
}) => {
  test.setTimeout(60000);
  const snap = populated(10);
  snap.sessions[10].agent = "alien";
  snap.sessions[10].registered = false;
  const api = await installSnapshotRoute(page, snap);
  await page.goto("/");
  const scene = page.getByLabel("3D office", { exact: true }),
    lead = scene.getByRole("button", {
      name: "Inspect Engineering lead",
      exact: true,
    });
  await expect(lead).toBeVisible({ timeout: 20000 });
  const identity = await lead.getAttribute("data-identity");
  await page.locator(".splash").waitFor({ state: "detached" });
  await page.screenshot({
    path: "test-results/office-evidence/maximum-light.png",
  });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/office-evidence/maximum-dark.png",
  });
  const rect = await lead.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height + 20);
  await page.mouse.down();
  await page.mouse.move(rect!.x + 60, rect!.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toHaveCount(0);
  snap.sessions[1].state = "waiting_input";
  api.setSnapshot(structuredClone(snap));
  await expect(
    page
      .getByLabel("Office roster")
      .getByRole("button", { name: /Worker Task worker-0/ }),
  ).toContainText("waiting");
  await expect(lead).toHaveAttribute("data-identity", identity!);
  await page
    .getByLabel("Office roster")
    .getByRole("button", { name: /Worker Task worker-9/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Unverified source");
});
test("characters: ten workers, permanent identities, actor selection and drag protection", async ({
  page,
}) => {
  await installSnapshotRoute(page, populated(10));
  await page.goto("/");
  const scene = page.getByLabel("3D office", { exact: true });
  await expect(scene.locator('[data-kind="worker"]')).toHaveCount(10, {
    timeout: 20000,
  });
  await expect(scene.locator('[data-kind="lead"]')).toHaveCount(6);
  await expect(scene.locator('[data-kind="assistant"]')).toHaveCount(1);
  await expect(scene.locator('[data-kind="human"]')).toHaveCount(1);
  await expect(
    page.getByLabel("Office roster").getByRole("button", { name: /^Worker / }),
  ).toHaveCount(11);
  await scene
    .getByRole("button", { name: "Inspect Executive assistant", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Build botanical office");
  await page.getByRole("button", { name: "Close observation" }).click();
  await scene
    .getByRole("button", { name: "Inspect Engineering lead", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Department representative");
  await page.getByRole("button", { name: "Close observation" }).click();
  await scene
    .getByRole("button", { name: "Inspect Task worker-0", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Session worker");
});
