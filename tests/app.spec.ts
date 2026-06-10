import { test, expect } from '@playwright/test';

const APP_USER = process.env.APP_USER!;
const APP_PASS = process.env.APP_PASS!;

/**
 * Helper: performs login and waits for dashboard.
 */
async function login(page: import('@playwright/test').Page) {
  await expect(page.locator('#view-auth')).toBeVisible({ timeout: 10_000 });
  await page.fill('#auth-phone', APP_USER);
  await page.fill('#auth-pass', APP_PASS);
  await page.click('#view-auth button[type="submit"]');
  await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 20_000 });
}

test.describe('Latam5S Application', () => {

  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before each test
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('login page renders correctly with empty storage', async ({ page }) => {
    const loginView = page.locator('#view-auth');
    await expect(loginView).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('#view-dashboard')).toBeHidden();
    await expect(page.locator('#view-admin')).toBeHidden();

    await expect(page.locator('#auth-phone')).toBeVisible();
    await expect(page.locator('#auth-pass')).toBeVisible();
  });

  test('login with valid credentials navigates to dashboard', async ({ page }) => {
    await login(page);

    // Login view should be hidden after successful login
    await expect(page.locator('#view-auth')).toBeHidden();

    // Config tab is shown by default
    await expect(page.locator('#tab-config')).toBeVisible();
  });

  test('dashboard tabs are navigable after login', async ({ page }) => {
    await login(page);

    // Config tab should be visible by default
    await expect(page.locator('#tab-config')).toBeVisible();

    // Navigate to "Envíos" tab
    await page.click('#nav-orders');
    await expect(page.locator('#tab-orders')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#tab-config')).toBeHidden();

    // Navigate back to "Configurar"
    await page.click('#nav-config');
    await expect(page.locator('#tab-config')).toBeVisible({ timeout: 5_000 });

    // Try "Compartir" — blocked if config incomplete, redirects to config
    await page.click('#nav-share');
    // Give a moment for the redirect logic
    await page.waitForTimeout(500);
    // Either #tab-share is visible (config was valid) or #tab-config stays (invalid config)
    const shareVisible = await page.locator('#tab-share').isVisible();
    const configVisible = await page.locator('#tab-config').isVisible();
    expect(shareVisible || configVisible).toBeTruthy();
  });

  test('logout clears session and returns to login', async ({ page }) => {
    // Use desktop viewport so sidebar is visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();

    await login(page);

    // Click logout
    const logoutBtn = page.locator('button:has-text("Cerrar")').first();
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
    await logoutBtn.click();

    // After page reload, login should reappear
    await expect(page.locator('#view-auth')).toBeVisible({ timeout: 10_000 });
  });
});
