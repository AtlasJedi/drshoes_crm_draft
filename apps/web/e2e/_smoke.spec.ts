/**
 * Smoke spec — loads /admin/login and asserts the page title text is present.
 *
 * PREREQUISITE: Run `make demo` in another terminal before executing this spec.
 * The full stack (Postgres + MinIO + Jaeger + backend + frontend) must be running
 * on http://localhost:3000.
 *
 * Run: pnpm --filter=web test:e2e
 * Run (headed): pnpm --filter=web exec playwright test --headed
 */
import { test, expect } from "@playwright/test";

test("login page loads with Dr Shoes title", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByText("Dr Shoes — Logowanie")).toBeVisible({ timeout: 10_000 });
});
