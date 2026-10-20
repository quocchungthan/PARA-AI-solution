import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { session, snapshot } from "../office/fixtures";

for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
  for (const theme of ["light", "dark"]) {
    test(`assignment reports stay distinct from delivery at ${viewport.width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const origin = "472ba074-289c-4cd6-9695-f0539f5ad6ec";
      const worker = "6de3445c-0470-4188-9130-a50637668652";
      const snap = snapshot([
        session(origin, "coordinator", "waiting_input", { title: "Supervisor", question: "Waiting for task reports" }),
        session(worker, "coder", "waiting_input", { title: "Worker", question: "Waiting for a prerequisite" }),
      ], [], {
        assignments: [{
          key: `${origin}:out:identity`, protocol: 2, originId: origin, targetId: worker,
          title: "Preserve source identity", mode: "new", points: 2,
          workState: "waiting", status: "assigned", acceptance: ["Restart preserves source identity"],
          dependsOn: [], writes: ["src/ImportIdentity.cs"],
          reports: [{ id: "wait-1", kind: "waiting", summary: "Need the dependency evidence before continuing.", evidence: [], verification: "Not run: waiting for dependency" }],
        }, {
          key: `${origin}:out:verify`, protocol: 2, originId: origin, targetId: "",
          title: "Verify identity", mode: "new", points: 1, workState: "queued", status: "pending",
          acceptance: ["No duplicate import after restart"], dependsOn: [`${origin}:out:identity`], writes: [], reports: [],
          scheduling: { code: "dependency", summary: "Waiting for Preserve source identity to complete.", blockingAssignmentIds: [`${origin}:out:identity`] },
        }],
        outboxReceipts: [{
          sessionId: origin, commandId: "invalid", status: "rejected", error: "Executable tasks must be 1-2 points.",
        }],
      });
      const api = await installSnapshotRoute(page, snap);
      await page.goto("/#view=tasks");
      const queue = page.getByRole("region", { name: "Team assignments", exact: true });
      await expect(queue).toBeVisible();
      if (theme === "dark") await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const task = queue.getByRole("article", { name: "Preserve source identity", exact: true });
      await expect(task).toContainText("waiting");
      await task.getByText("Scope and reports (1)", { exact: true }).click();
      await expect(task.locator(".assignmentReports").getByText("Need the dependency evidence before continuing.", { exact: true })).toBeVisible();
      await expect(task.getByText("Verification: Not run: waiting for dependency", { exact: true })).toBeVisible();
      const dependent = queue.getByRole("article", { name: "Verify identity", exact: true });
      await expect(queue.getByRole("region", { name: "Queued tasks", exact: true }).getByRole("article", { name: "Verify identity" })).toBeVisible();
      await expect(queue.getByRole("region", { name: "Waiting / attention tasks", exact: true }).getByRole("article", { name: "Preserve source identity" })).toBeVisible();
      await expect(dependent.getByRole("button", { name: "Open worker", exact: true })).toBeDisabled();
      await expect(dependent).toContainText("Depends on:");
      await expect(dependent).toContainText("Why queued");
      await expect(dependent).toContainText("Blocking task: Preserve source identity");
      await queue.getByText("Rejected outbox commands (1)", { exact: true }).click();
      await expect(queue.getByText("invalid: Executable tasks must be 1-2 points.", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await task.getByRole("button", { name: "Open supervisor", exact: true }).click();
      await expect(page.locator(".drawerTitle")).toHaveText("Supervisor");
      await page.getByRole("button", { name: "Close (Esc)" }).click();

      snap.assignments![0].workState = "done";
      snap.assignments![0].reports.push({
        id: "complete-1", kind: "done", summary: "Identity behavior verified locally.",
        evidence: ["tests/ImportIdentityTests.cs"], verification: "Focused restart and duplicate checks passed",
      });
      api.setSnapshot(structuredClone(snap));
      await expect(task).toContainText("done");
      await task.getByText("Scope and reports (2)", { exact: true }).click();
      await expect(task.locator(".assignmentReports").getByText("Identity behavior verified locally.", { exact: true })).toBeVisible();
      await expect(task).toContainText("Evidence: tests/ImportIdentityTests.cs");
      // A child completion does not mark its waiting sibling or root conversation done.
      await expect(dependent).toContainText("queued");
    });
  }

}

test("an unreadable ledger is not presented as an empty successful queue", async ({ page }) => {
  await installSnapshotRoute(page, snapshot([], [], {
    assignments: [],
    assignmentError: "The assignment ledger could not be read. Existing work has not been reset.",
  }));
  await page.goto("/#view=tasks");
  const queue = page.getByRole("region", { name: "Team assignments", exact: true });
  await expect(queue.getByRole("alert")).toContainText("could not be read");
  await expect(queue.getByText("No assignments yet.", { exact: false })).toHaveCount(0);
});
