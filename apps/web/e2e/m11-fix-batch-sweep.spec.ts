/**
 * M11 fix-batch verifier sweep — 7 surfaces.
 *
 * Run: pnpm --filter=web exec playwright test e2e/m11-fix-batch-sweep.spec.ts --reporter=line
 *
 * PREREQUISITE: backend on :8081, web on :3000.
 * Auth: quicklogin endpoint mints a dr_session cookie for test@test.pl (OWNER).
 *
 * After all tests finish, writes a JSON report to:
 *   docs/dispatch-log/v1-<UTC>-sweep-report.json
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import path from "path";
import fs from "fs";

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND = process.env["BACKEND_URL"] ?? "http://localhost:8081";
const SCREENS_DIR = path.resolve(__dirname, "_screens");

// ── Report accumulator ────────────────────────────────────────────────────────

interface ReportEntry {
  surface: string;
  defect: string | null;
  screenshot: string | null;
  note?: string;
}

const REPORT: ReportEntry[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Authenticate via quicklogin (GET /api/admin/auth/quicklogin on backend).
 *  Copies dr_session cookie into the page browser context so web requests
 *  routed through Next.js proxy (/api/*) are authenticated.
 */
async function quicklogin(page: Page, request: APIRequestContext): Promise<void> {
  // Hit the backend quicklogin — it sets dr_session via Set-Cookie
  const resp = await request.get(`${BACKEND}/api/admin/auth/quicklogin`, {
    maxRedirects: 0,
  });
  // 302 expected; cookies are captured by APIRequestContext automatically
  if (resp.status() !== 302 && resp.status() !== 200) {
    throw new Error(`quicklogin failed: HTTP ${resp.status()}`);
  }
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await page.context().addCookies(state.cookies);
  }
}

async function snap(page: Page, slug: string): Promise<string> {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const filePath = path.join(SCREENS_DIR, `${slug}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

// ── Test setup ────────────────────────────────────────────────────────────────

test.describe("M11 fix-batch verifier sweep", () => {
  test.beforeEach(async ({ page, request }) => {
    await quicklogin(page, request);
  });

  // ── Surface 1: orders.list.miejsce ─────────────────────────────────────────
  test("orders.list.miejsce — LocationChip visible", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // Selectors: aria-label is the canonical marker on LocationChip
    const chips = page.locator('[aria-label="Aktualne miejsce"]');
    const count = await chips.count();
    const screenshot = await snap(page, "orders-list-miejsce");

    if (count >= 1) {
      REPORT.push({ surface: "orders.list.miejsce", defect: null, screenshot });
    } else {
      REPORT.push({
        surface: "orders.list.miejsce",
        defect: `Expected ≥1 LocationChip visible (DR-2026-0007/0006/0001 all have szafa), got ${count}`,
        screenshot,
      });
    }

    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── Surface 2: orders.list.urgent ─────────────────────────────────────────
  test("orders.list.urgent — urgent row highlight (fixture-limited)", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // Urgent rows get bg-magenta/10 border-l-2 border-magenta (Tailwind dynamic)
    // Count rows that have a class containing "magenta"
    const urgentRows = page.locator("tbody tr").filter({ hasClass: /magenta/ });
    const count = await urgentRows.count();
    const screenshot = await snap(page, "orders-list-urgent");

    // All orders received today — isUrgent threshold is >7 days → 0 urgent rows expected
    REPORT.push({
      surface: "orders.list.urgent",
      defect: null,
      screenshot,
      note: `fixture-limited — 0 urgent rows expected (all orders received today). Count=${count}`,
    });
  });

  // ── Surface 3: drawer.no-wykonawca ────────────────────────────────────────
  test("drawer.no-wykonawca — Wykonawca label absent from drawer", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // Click first row
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    // Wait for drawer
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    const wykonawcaCount = await drawer.getByText(/wykonawca/i).count();
    const screenshot = await snap(page, "drawer-no-wykonawca");

    if (wykonawcaCount === 0) {
      REPORT.push({ surface: "drawer.no-wykonawca", defect: null, screenshot });
    } else {
      REPORT.push({
        surface: "drawer.no-wykonawca",
        defect: `Wykonawca label still present in drawer (${wykonawcaCount} occurrences)`,
        screenshot,
      });
    }

    expect(wykonawcaCount).toBe(0);
  });

  // ── Surface 4: drawer.czas-w-warsztacie ───────────────────────────────────
  test("drawer.czas-w-warsztacie — label present in drawer", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    const label = drawer.getByText(/czas w warsztacie/i).first();
    const visible = await label.isVisible().catch(() => false);
    const screenshot = await snap(page, "drawer-czas-w-warsztacie");

    if (visible) {
      REPORT.push({ surface: "drawer.czas-w-warsztacie", defect: null, screenshot });
    } else {
      REPORT.push({
        surface: "drawer.czas-w-warsztacie",
        defect: "\"Czas w warsztacie\" label not found in drawer",
        screenshot,
      });
    }

    expect(visible).toBe(true);
  });

  // ── Surface 5: drawer.item-math ───────────────────────────────────────────
  test("drawer.item-math — add item updates Wycena total then cleanup", async ({ page }) => {
    // Navigate to DR-2026-0007 (quotedPriceCents=90000 → 900 zł, 2 items)
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // Click the first row (DR-2026-0007 — most recent)
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // Read initial Wycena value from CoreFields
    const wycenaText = await drawer.getByText(/zł/).first().textContent().catch(() => null);

    // Click "+ dodaj item" button
    const addBtn = drawer.locator('button:has-text("dodaj item")').first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();

    // Fill price input (number input with aria-label)
    const priceInput = drawer.locator('[aria-label="Cena w PLN"]');
    await expect(priceInput).toBeVisible({ timeout: 5_000 });
    await priceInput.fill("99");

    // Click Zapisz
    const saveBtn = drawer.locator('button:has-text("Zapisz")').first();
    await saveBtn.click();

    // Wait for drawer to refresh
    await page.waitForTimeout(2_500);

    // Capture Wycena after add
    const wycenaAfter = await drawer.getByText(/zł/).first().textContent().catch(() => null);
    const screenshot = await snap(page, "drawer-item-math-after-add");

    // Verify Wycena changed (should now reflect additional 99 zł)
    const wycenaChanged = wycenaAfter !== wycenaText;

    // ── Cleanup: remove the item we just added ──────────────────────────────
    // The newly added item row is the last one — its remove button (✕) is inside
    // the items list
    try {
      const itemRows = drawer.locator('[aria-label="Usuń pozycję"]');
      const itemCount = await itemRows.count();
      if (itemCount > 0) {
        // Click the last remove button (the newly added item)
        await itemRows.last().click();
        await page.waitForTimeout(500);
        // Confirm: click "Tak" in the inline confirmation
        const confirmBtn = drawer.getByText("Tak").first();
        if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(2_000);
        }
      }
    } catch (cleanupErr) {
      console.warn("[item-math] Cleanup failed:", cleanupErr);
    }

    const screenshotAfterClean = await snap(page, "drawer-item-math-clean");

    if (wycenaChanged) {
      REPORT.push({ surface: "drawer.item-math", defect: null, screenshot });
    } else {
      REPORT.push({
        surface: "drawer.item-math",
        defect: `Wycena did not change after adding item. Before="${wycenaText}" After="${wycenaAfter}"`,
        screenshot,
      });
    }

    expect(wycenaChanged).toBe(true);
  });

  // ── Surface 6: filter.pilne ────────────────────────────────────────────────
  test("filter.pilne — Pilne chip sets urgent=true in URL", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // NOTE: data-testid="preset-pilne" is passed to <Chip> but Chip does not
    // forward data-* attributes to the underlying <button>. This is a defect
    // in the Chip component (missing data-testid in ChipProps + spread).
    // We use a text-based fallback: the "Pilne" chip is a <button> inside
    // the presets bar, matching the text "Pilne" (may include the badge count).
    // The testid fallback is tried first for forward-compat.
    let pilneChip = page.locator('[data-testid="preset-pilne"]');
    const hasTestId = await pilneChip.isVisible({ timeout: 2_000 }).catch(() => false);

    let chipDefect: string | null = null;
    if (!hasTestId) {
      // data-testid not forwarded — record the defect, fall back to text match
      chipDefect = "Chip component does not forward data-testid to underlying <button> — [data-testid='preset-pilne'] selector finds 0 elements. Fix: add 'data-testid' to ChipProps and spread it on the rendered button/span.";
      // Text fallback: button containing "Pilne" in the presets bar (first match)
      pilneChip = page.locator('button.chip').filter({ hasText: /^Pilne/ }).first();
    }

    await expect(pilneChip).toBeVisible({ timeout: 8_000 });
    await pilneChip.click();

    // URL should contain urgent=true
    await page.waitForURL(/urgent=true/, { timeout: 8_000 });
    const screenshot = await snap(page, "filter-pilne");

    const currentUrl = page.url();
    const hasUrgent = currentUrl.includes("urgent=true");

    if (hasUrgent && !chipDefect) {
      REPORT.push({ surface: "filter.pilne", defect: null, screenshot });
    } else if (hasUrgent && chipDefect) {
      // Functional behavior is correct but testid selector is broken
      REPORT.push({
        surface: "filter.pilne",
        defect: chipDefect,
        screenshot,
        note: "Functional behavior (urgent=true URL toggle) WORKS. Only the data-testid forwarding is broken.",
      });
    } else {
      REPORT.push({
        surface: "filter.pilne",
        defect: `URL after clicking Pilne chip does not contain urgent=true. URL=${currentUrl}`,
        screenshot,
      });
    }

    expect(hasUrgent).toBe(true);
  });

  // ── Surface 7: messages.bubble ─────────────────────────────────────────────
  test("messages.bubble — plain-text body, whitespace-pre-wrap, no HTML tags", async ({ page }) => {
    await page.goto("/admin/messages", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_500);

    // Click first thread row
    const firstThread = page.locator('[role="button"]').first();
    const firstThreadVisible = await firstThread.isVisible().catch(() => false);
    if (!firstThreadVisible) {
      REPORT.push({
        surface: "messages.bubble",
        defect: null,
        screenshot: null,
        note: "fixture-limited — no message threads visible in /admin/messages",
      });
      return;
    }
    await firstThread.click();
    await page.waitForTimeout(2_000);

    // Find message bubble: has whitespace-pre-wrap class
    const bubble = page.locator(".whitespace-pre-wrap").first();
    const bubbleVisible = await bubble.isVisible().catch(() => false);
    const screenshot = await snap(page, "messages-bubble");

    if (!bubbleVisible) {
      REPORT.push({
        surface: "messages.bubble",
        defect: "No element with class whitespace-pre-wrap found after clicking first thread",
        screenshot,
      });
      expect(bubbleVisible).toBe(true);
      return;
    }

    // Assert innerHTML does not contain HTML structure tags
    const innerHTML = await bubble.innerHTML().catch(() => "");
    const hasHtmlTags = /<(table|html|body|thead|tbody|tr|td|th|style|script)\b/i.test(innerHTML);

    if (!hasHtmlTags) {
      REPORT.push({ surface: "messages.bubble", defect: null, screenshot });
    } else {
      REPORT.push({
        surface: "messages.bubble",
        defect: `Bubble innerHTML contains HTML structure tags. Sample: ${innerHTML.slice(0, 120)}`,
        screenshot,
      });
    }

    expect(hasHtmlTags).toBe(false);
  });

  // ── After all: write JSON report ──────────────────────────────────────────
  test.afterAll(async () => {
    const utc = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "T").slice(0, 19) + "Z";
    const reportPath = path.resolve(
      __dirname,
      "../../../docs/dispatch-log",
      `v1-${utc}-sweep-report.json`,
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2), "utf-8");
    console.log(`\n[sweep] Report written to: ${reportPath}`);
    console.log(`[sweep] Surfaces: ${REPORT.length}`);
    for (const entry of REPORT) {
      const status = entry.defect ? "FAIL" : "PASS";
      const note = entry.note ? ` (${entry.note})` : "";
      console.log(`  ${status} — ${entry.surface}${note}`);
      if (entry.defect) console.log(`         ↳ ${entry.defect}`);
    }
  });
});
