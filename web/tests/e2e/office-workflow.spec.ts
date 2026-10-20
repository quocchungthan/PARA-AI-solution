import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { session, snapshot } from "../office/fixtures";

for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
  for (const theme of ["light", "dark"]) {
    test(`task approval remains explicit at ${viewport.width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const task = session("b23fe81f-01eb-46be-8ef3-573af32c2c5d", "coordinator", "needs_human", {
        title: "Fix issue import",
        phase: "approval",
        task: "Source: synthetic issue. Scope: fix issue import. Acceptance: preserve source ID and avoid duplicates.",
        needs: [{ resolver: "human", text: "Implementation approval" }],
        question: "Should PARA implement the proposed import fix?",
        progress: [{ ts: new Date().toISOString(), note: "Analyzed import behavior; scope is local, with no PR." }],
      });
      const snap = snapshot([task]);
      const api = await installSnapshotRoute(page, snap);
      let writes = 0;
      await page.route(`http://localhost:5310/api/sessions/${task.sessionId}/reply`, async (route) => {
        const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers });
          return;
        }
        writes++;
        expect(route.request().postDataJSON().message).toContain("Approved:");
        snap.deliveries = [{ sessionId: task.sessionId, messageId: "decision", from: "user", status: "pending", attempts: 0 }];
        api.setSnapshot(structuredClone(snap));
        await route.fulfill({ status: 202, headers, json: { messageId: "decision", status: "pending" } });
      });
      await page.goto("/#view=sessions");
      await expect(page.getByRole("heading", { name: "Session phases" })).toBeVisible();
      if (theme === "dark") await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const board = page.getByRole("region", { name: "Session phases" });
      await expect(board.getByRole("region", { name: "Your approval" }).getByRole("button", { name: /Fix issue import/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await board.getByRole("button", { name: /Fix issue import/ }).click();
      const approve = page.getByRole("button", { name: "Approve implementation", exact: true });
      await approve.click();
      await expect(page.getByLabel("Your response")).toHaveValue(/Approved:.*Do not open a PR/);
      expect(writes).toBe(0);
      await page.getByRole("button", { name: "Send reply", exact: true }).click();
      await expect(page.getByText("Your latest reply: pending")).toBeVisible();
      await expect(page.getByRole("button", { name: "Awaiting delivery", exact: true })).toBeDisabled();
      await expect(approve).toBeDisabled();
      expect(writes).toBe(1);
      expect(snap.sessions[0].phase).toBe("approval");
      await expect(board.getByRole("region", { name: "Delivered locally" }).getByRole("button")).toHaveCount(0);

      snap.sessions[0] = { ...task, phase: "implementation", state: "working", needs: [], question: undefined };
      snap.deliveries![0].status = "delivered";
      api.setSnapshot(structuredClone(snap));
      await expect(page.getByText("Your latest reply: delivered")).toBeVisible();
      await expect(approve).toHaveCount(0);
      await page.getByRole("button", { name: "Close (Esc)" }).click();
      await expect(board.getByRole("region", { name: "Implement", exact: true }).getByRole("button", { name: /Fix issue import/ })).toBeVisible();
      snap.sessions[0] = { ...task, phase: "implementation", state: "needs_human" };
      api.setSnapshot(structuredClone(snap));
      const blocked = board.getByRole("region", { name: "Implement", exact: true }).getByRole("button", { name: /Fix issue import/ });
      await expect(blocked).toContainText("Needs your input");
      await expect(board).toContainText("Recorded phases are not execution status");
    });
  }
}
