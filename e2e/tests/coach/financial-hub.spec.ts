import { test, expect } from '@playwright/test';
import { authenticateCoach, hasCoachCredentials, requireCoachCredentials } from '../../helpers/auth';
import { CoachPortalPage } from '../../pages/coach-portal.page';

test.describe('Hub Financeiro (coach)', () => {
  test.skip(!hasCoachCredentials(), 'Defina E2E_COACH_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireCoachCredentials();
    await authenticateCoach(page, request, email, password);
  });

  test('navega para Visão Geral via hub Financeiro', async ({ page }) => {
    const coach = new CoachPortalPage(page);
    await coach.expectDashboard();
    await coach.openFinancialSubItem('Visão Geral');
    await coach.expectFinancialOverview();
    await expect(page).toHaveURL(/\/financeiro\/?$/);
  });

  test('navega para Cobranças', async ({ page }) => {
    const coach = new CoachPortalPage(page);
    await coach.expectDashboard();
    await coach.openFinancialSubItem('Cobranças');
    await coach.expectChargesPage();
    await expect(page).toHaveURL(/\/financeiro\/cobrancas/);
  });

  test('redirect legacy ?tab=financial-dashboard para /financeiro', async ({ page }) => {
    await page.goto('/?tab=financial-dashboard');
    await expect(page).toHaveURL(/\/financeiro\/?$/);
    const coach = new CoachPortalPage(page);
    await coach.expectFinancialOverview();
  });

  test('redirect legacy ?tab=payments-tracker para cobranças', async ({ page }) => {
    await page.goto('/?tab=payments-tracker');
    await expect(page).toHaveURL(/\/financeiro\/cobrancas/);
  });
});
