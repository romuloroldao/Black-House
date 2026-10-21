import type { Page } from '@playwright/test';

/** Limpa cookies e storage antes de testes de auth na UI. */
export async function clearAuthSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/auth');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
