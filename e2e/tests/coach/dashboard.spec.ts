import { test, expect } from '@playwright/test';
import { authenticateCoach, hasCoachCredentials, requireCoachCredentials } from '../../helpers/auth';
import { CoachPortalPage } from '../../pages/coach-portal.page';

test.describe('Painel do coach (desktop)', () => {
  test.skip(!hasCoachCredentials(), 'Defina E2E_COACH_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireCoachCredentials();
    await authenticateCoach(page, request, email, password);
  });

  test('dashboard carrega métricas principais', async ({ page }) => {
    const coach = new CoachPortalPage(page);
    await coach.expectDashboard();
    await expect(page).toHaveURL(/tab=dashboard/);
  });

  test('navega para Gestão de Alunos', async ({ page }) => {
    const coach = new CoachPortalPage(page);
    await coach.expectDashboard();
    await coach.openSidebarTab('Alunos');
    await coach.expectStudentsManager();
    await expect(page).toHaveURL(/tab=students/);
  });

  test('navega para Nutrição', async ({ page }) => {
    const coach = new CoachPortalPage(page);
    await coach.expectDashboard();
    await coach.openSidebarTab('Nutrição');
    await coach.expectNutritionTab();
    await expect(page).toHaveURL(/tab=nutrition/);
  });
});
