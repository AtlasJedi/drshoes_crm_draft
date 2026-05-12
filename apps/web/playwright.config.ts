import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Dr Shoes admin E2E tests.
 *
 * Prerequisite: stack running via `make demo` on http://localhost:3000, OR
 * running inside Docker via `docker compose --profile e2e run playwright`.
 *
 * BASE_URL env var controls the target (default: http://localhost:3000).
 * When running inside Docker the compose service sets BASE_URL=http://web:3000
 * so requests go over the internal Docker network (bypassing macOS port-forwarding
 * which drops chunked RSC streams mid-flight on Docker Desktop).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 0 : 2,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:3000",
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
