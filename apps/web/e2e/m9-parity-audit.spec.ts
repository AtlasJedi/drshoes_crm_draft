/**
 * M9 parity audit — full-page screenshot sweep.
 *
 * PREREQUISITE: stack running (make demo or docker compose up + pnpm run dev).
 * After the run, screenshots land in screenshots/m9-parity/ relative to the
 * repo root (configured via SCREENSHOT_DIR below).
 *
 * Run: pnpm --filter=web exec playwright test m9-parity-audit --headed
 * Or headless: pnpm --filter=web exec playwright test m9-parity-audit
 *
 * The spec intentionally does NOT assert pixel equality — it produces
 * screenshots for manual visual comparison against handoff/design/.
 * Soft assertions note mismatches in the console without failing the spec.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../../screenshots/m9-parity");

/**
 * Login via APIRequestContext (avoids Docker streaming issues on macOS).
 * Copies session + XSRF cookies into the page browser context.
 */
async function login(page: Page, request: APIRequestContext): Promise<void> {
  const resp = await request.post("/api/admin/auth/login", {
    data: { email: "misza@drshoes.pl", password: "change-me-on-first-login" },
    headers: { "Content-Type": "application/json" },
  });
  if (resp.status() !== 204) {
    throw new Error(`Login failed: HTTP ${resp.status()} — is the demo stack running?`);
  }
  // GET /api/admin/auth/me to materialise XSRF-TOKEN cookie (lazy Spring CSRF).
  await request.get("/api/admin/auth/me");
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await page.context().addCookies(state.cookies);
  }
}

/** Navigate and take a full-page screenshot, returning the file path. */
async function snap(page: Page, route: string, slug: string): Promise<string> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto(route, { waitUntil: "commit", timeout: 20_000 });
  // Give RSC hydration time to settle before screenshotting.
  await page.waitForTimeout(1_500);
  const filePath = path.join(SCREENSHOT_DIR, `${slug}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  [snap] ${slug} → ${filePath}`);
  return filePath;
}

test.describe("M9 parity audit — screenshot sweep", () => {
  test.beforeEach(async ({ page, request }) => {
    await login(page, request);
  });

  /** Public landing — no auth needed but login context is harmless */
  test("public-landing", async ({ page }) => {
    await snap(page, "/", "public-landing");
    // Soft: assert hero heading exists
    const hero = page.locator("h1");
    const count = await hero.count();
    if (count === 0) {
      console.warn("AUDIT GAP [public-landing]: <h1> missing — landing may not be rendered");
    }
  });

  test("admin-dashboard", async ({ page }) => {
    await snap(page, "/admin", "admin-dashboard");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-orders-list", async ({ page }) => {
    await snap(page, "/admin/orders", "admin-orders-list");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-orders-calendar", async ({ page }) => {
    await snap(page, "/admin/orders/calendar", "admin-orders-calendar");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-orders-kanban", async ({ page }) => {
    await snap(page, "/admin/orders/kanban", "admin-orders-kanban");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-orders-new", async ({ page }) => {
    await snap(page, "/admin/orders/new", "admin-orders-new");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-messages", async ({ page }) => {
    await snap(page, "/admin/messages", "admin-messages");
    // MessagesShell renders a nested <main> inside the layout <main>;
    // use .first() to avoid strict-mode violation from the double match.
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("admin-clients", async ({ page }) => {
    await snap(page, "/admin/clients", "admin-clients");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-triggers", async ({ page }) => {
    await snap(page, "/admin/triggers", "admin-triggers");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-templates", async ({ page }) => {
    await snap(page, "/admin/templates", "admin-templates");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-sklep", async ({ page }) => {
    await snap(page, "/admin/sklep", "admin-sklep");
    await expect(page.locator("main")).toBeVisible();
  });

  test("admin-aktualnosci", async ({ page }) => {
    await snap(page, "/admin/aktualnosci", "admin-aktualnosci");
    await expect(page.locator("main")).toBeVisible();
  });
});
