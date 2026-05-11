import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Dr Shoes admin E2E tests.
 * Prerequisite: stack running via `make demo` on http://localhost:3000.
 * Chromium only — headless by default, headed via `--headed` flag.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 0 : 2,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results/",
});
