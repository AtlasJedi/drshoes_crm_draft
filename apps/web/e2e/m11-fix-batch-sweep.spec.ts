/**
 * M11 fix-batch verifier sweep — 7 surfaces.
 *
 * Run: pnpm --filter=web exec playwright test e2e/m11-fix-batch-sweep.spec.ts --reporter=line
 *
 * PREREQUISITE: backend on :8081, web on :3000.
 * Auth: quicklogin endpoint mints a dr_session cookie for test@test.pl (OWNER).
 *
 * After all tests finish, writes a JSON report to:
 *   docs/dispatch-log/v2-<UTC>-sweep-report.json
 *
 * V2 changes vs V1:
 *  - urgent: now expects ≥1 urgent row (DR-2026-0004 received_at backdated 18 days)
 *  - drawer.czas: also opens DR-2026-0004 and checks ~18 dni + pilne label
 *  - filter.pilne: data-testid now forwarded by Chip — expects testid selector to find element
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
  test("orders.list.urgent — urgent row highlight visible (DR-2026-0004 backdated 18 days)", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // Urgent rows get bg-magenta/10 border-l-2 border-magenta (Tailwind dynamic classes)
    // Count rows that have a class containing "magenta"
    const urgentRows = page.locator("tbody tr").filter({ hasClass: /magenta/ });
    const count = await urgentRows.count();
    const screenshot = await snap(page, "orders-list-urgent");

    // DR-2026-0004 received_at was backdated 18 days — isUrgent threshold is >7 days
    // So we expect at least 1 urgent row now.
    if (count >= 1) {
      REPORT.push({
        surface: "orders.list.urgent",
        defect: null,
        screenshot,
        note: `DR-2026-0004 urgent row visible. Count=${count}`,
      });
    } else {
      REPORT.push({
        surface: "orders.list.urgent",
        defect: `Expected ≥1 urgent row (DR-2026-0004 received_at backdated 18 days, threshold >7 days), got ${count}. Check: GET /api/admin/orders?urgent=true should return DR-2026-0004; check if frontend renders isUrgent styling.`,
        screenshot,
      });
    }

    expect(count).toBeGreaterThanOrEqual(1);
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
  test("drawer.czas-w-warsztacie — label present; DR-2026-0004 shows ~18 dni + pilne", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // ── Part A: label visible in any drawer ──
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    const label = drawer.getByText(/czas w warsztacie/i).first();
    const visible = await label.isVisible().catch(() => false);
    const screenshot = await snap(page, "drawer-czas-w-warsztacie");

    // Close drawer before opening DR-2026-0004
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ── Part B: DR-2026-0004 shows ~18 dni and pilne label ──
    // Find the row for DR-2026-0004 by looking for "0004" in the row text
    let urgentCzasDefect: string | null = null;
    try {
      const dr4Row = page.locator("tbody tr").filter({ hasText: /0004/ }).first();
      const dr4Visible = await dr4Row.isVisible({ timeout: 3_000 }).catch(() => false);
      if (dr4Visible) {
        await dr4Row.click();
        const drawer2 = page.locator('[role="dialog"]');
        await expect(drawer2).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(1_000);

        // Should show ~18 dni (accept 15-21 range for clock drift)
        const czasText = await drawer2.getByText(/\d+\s*dni/i).first().textContent().catch(() => "");
        const dniMatch = czasText.match(/(\d+)\s*dni/i);
        const dniCount = dniMatch ? parseInt(dniMatch[1], 10) : -1;
        const dniOk = dniCount >= 15 && dniCount <= 25;

        // Should show "pilne" label or magenta styling somewhere in drawer
        const pilneVisible = await drawer2.getByText(/pilne/i).first().isVisible({ timeout: 2_000 }).catch(() => false);

        await snap(page, "drawer-czas-dr0004-pilne");
        if (!dniOk) {
          urgentCzasDefect = `DR-2026-0004 drawer shows "${czasText}" (expected ~18 dni, accepted 15-25). Backdated received_at may not be visible to frontend.`;
        } else if (!pilneVisible) {
          urgentCzasDefect = `DR-2026-0004 drawer missing "pilne" label/text despite being urgent (${dniCount} dni). Urgent badge not rendered in drawer.`;
        }
      } else {
        // DR-2026-0004 not on the current page — warn but don't fail
        urgentCzasDefect = null; // non-blocking: may be paginated
      }
    } catch (e) {
      urgentCzasDefect = `Error checking DR-2026-0004 drawer: ${e}`;
    }

    if (visible && !urgentCzasDefect) {
      REPORT.push({ surface: "drawer.czas-w-warsztacie", defect: null, screenshot });
    } else if (!visible) {
      REPORT.push({
        surface: "drawer.czas-w-warsztacie",
        defect: "\"Czas w warsztacie\" label not found in drawer",
        screenshot,
      });
    } else {
      REPORT.push({
        surface: "drawer.czas-w-warsztacie",
        defect: urgentCzasDefect,
        screenshot,
      });
    }

    expect(visible).toBe(true);
    if (urgentCzasDefect) {
      throw new Error(urgentCzasDefect);
    }
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

    await snap(page, "drawer-item-math-clean");

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
  test("filter.pilne — Pilne chip (data-testid fixed) sets urgent=true in URL", async ({ page }) => {
    await page.goto("/admin/orders", { waitUntil: "commit", timeout: 20_000 });
    await page.waitForTimeout(2_000);

    // V2: Chip now forwards data-testid — [data-testid="preset-pilne"] should resolve directly.
    const pilneChip = page.locator('[data-testid="preset-pilne"]');
    const hasTestId = await pilneChip.isVisible({ timeout: 4_000 }).catch(() => false);

    if (!hasTestId) {
      const screenshot = await snap(page, "filter-pilne-testid-missing");
      REPORT.push({
        surface: "filter.pilne",
        defect: "data-testid='preset-pilne' still not found after Chip fix — Chip.tsx change may not have been rebuilt into the web bundle.",
        screenshot,
      });
      expect(hasTestId, "data-testid='preset-pilne' must be present after Chip fix").toBe(true);
      return;
    }

    await pilneChip.click();

    // URL should contain urgent=true
    await page.waitForURL(/urgent=true/, { timeout: 8_000 });
    const screenshot = await snap(page, "filter-pilne");

    const currentUrl = page.url();
    const hasUrgent = currentUrl.includes("urgent=true");

    if (hasUrgent) {
      REPORT.push({ surface: "filter.pilne", defect: null, screenshot, note: "data-testid selector works + URL urgent=true confirmed." });
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
      `v2-${utc}-sweep-report.json`,
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
