import { defineConfig } from "@playwright/test";
const production = process.env.OFFICE_PRODUCTION === "1";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "office-*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: process.env.OFFICE_GPU_PROFILE === "1" ? "msedge" : undefined,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args:
        process.env.OFFICE_GPU_PROFILE === "1"
          ? []
          : [
              "--use-gl=angle",
              "--use-angle=swiftshader",
              "--enable-unsafe-swiftshader",
            ],
    },
  },
  webServer: {
    command: production
      ? "npm run preview -- --host 127.0.0.1 --port 5173 --base /office-check/"
      : "npm run dev -- --host 127.0.0.1",
    url: production
      ? "http://127.0.0.1:5173/office-check/"
      : "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
});
