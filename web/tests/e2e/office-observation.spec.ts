import { test, expect } from "@playwright/test";
import { installSnapshotRoute } from "./snapshotRoute";
import { populated, session } from "../office/fixtures";
test("observation: floor scope, department aggregates, worker details and existing drawer", async ({
  page,
}) => {
  const snap = populated(2);
  snap.sessions.push(
    session("second", "coordinator", "working", { title: "Another project" }),
  );
  await installSnapshotRoute(page, snap);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Office", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Conversation floor")).toContainText(
    "Another project",
  );
  await page
    .getByRole("button", { name: "Engineering lead", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Office observation" }),
  ).toContainText("Department representative");
  await page.getByRole("button", { name: /Worker Task worker-0/ }).click();
  const details = page.getByRole("complementary", {
    name: "Office observation",
  });
  await expect(details).toContainText("Task worker-0");
  await expect(details).toContainText("Build botanical office");
  await expect(details.locator("textarea")).toHaveCount(0);
  await details
    .getByRole("button", { name: "Open session", exact: true })
    .click();
  await expect(page).toHaveURL(/session=worker-0/);
  await expect(details).toHaveCount(0);
});
test("observation: empty and unknown sessions are accessible without fabricated floors", async ({
  page,
}) => {
  await installSnapshotRoute(page, {
    ...populated(0),
    sessions: [session("orphan", "unknown", "done", { registered: false })],
    delegations: [],
  });
  await page.goto("/");
  await expect(page.getByText("No conversation floor yet")).toBeVisible();
  await page.getByText("Ungrouped sessions").click();
  await expect(page.getByText(/No recorded path/)).toBeVisible();
});
