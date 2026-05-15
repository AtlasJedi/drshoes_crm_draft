// apps/web/e2e/public-landing.spec.ts
// Playwright E2E smoke tests for the public landing page.
// Requires a running dev stack (excluded from vitest; run manually or in CI with stack).
// Task: 9-40 — compose full public landing.

import { test, expect } from '@playwright/test';

test.describe('Public landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('StickyNav links have correct anchors', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Aktualności/i }))
      .toHaveAttribute('href', '#aktualnosci');
    await expect(page.getByRole('link', { name: /Sklep/i }))
      .toHaveAttribute('href', '#sklep');
    await expect(page.getByRole('link', { name: /Kontakt/i }))
      .toHaveAttribute('href', '#kontakt');
  });

  test('hero CTAs both point to #zamow', async ({ page }) => {
    const zamowLink = page.getByRole('link', { name: /Zamów custom/i });
    await expect(zamowLink.first()).toHaveAttribute('href', '#zamow');
    const naprawaLink = page.getByRole('link', { name: /Oddaj buty do naprawy/i });
    await expect(naprawaLink).toHaveAttribute('href', '#zamow');
  });

  test('scrolling to #aktualnosci section', async ({ page }) => {
    await page.getByRole('link', { name: /Aktualności/i }).first().click();
    await expect(page.locator('#aktualnosci')).toBeInViewport();
  });

  test('scrolling to #sklep section', async ({ page }) => {
    await page.getByRole('link', { name: /Sklep/i }).first().click();
    await expect(page.locator('#sklep')).toBeInViewport();
  });

  test('scrolling to #kontakt section', async ({ page }) => {
    await page.getByRole('link', { name: /Kontakt/i }).first().click();
    await expect(page.locator('#kontakt')).toBeInViewport();
  });
});
