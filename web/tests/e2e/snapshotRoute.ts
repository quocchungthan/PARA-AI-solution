import type { Page } from "@playwright/test";
import type { Snapshot } from "../../src/store";
export async function installSnapshotRoute(page: Page, initial: Snapshot) {
  let current = initial,
    fail = false;
  await page.addInitScript(() => {
    localStorage.setItem("bridge-theme", "light");
  });
  await page.route("http://localhost:5310/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/snapshot") {
      if (fail) {
        await route.abort();
        return;
      }
      await route.fulfill({
        json: current,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
      return;
    }
    if (url.pathname.endsWith("/inspect")) {
      await route.fulfill({
        json: {
          sessionId: "synthetic",
          available: true,
          diagnosis: "Synthetic browser fixture",
          recent: [],
        },
      });
      return;
    }
    await route.fulfill({
      status: 405,
      body: "Browser fixtures never write to Bridge",
    });
  });
  return {
    setSnapshot(next: Snapshot) {
      current = next;
    },
    failSnapshotRequests(value: boolean) {
      fail = value;
    },
  };
}
