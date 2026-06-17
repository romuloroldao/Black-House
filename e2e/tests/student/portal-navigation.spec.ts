import { test, expect } from '@playwright/test';
import { authenticateStudent, hasStudentCredentials, requireStudentCredentials } from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Portal do aluno (mobile)', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);
  });

  test('carrega aba Hoje após login', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.expectTodayView();
    await expect(page).toHaveURL(/tab=hoje/);
  });

  test('navega pelas 4 abas da bottom nav', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();

    await portal.openTab('diet');
    await portal.expectDietView();

    await portal.openTab('workouts');
    await portal.expectWorkoutsView();

    await portal.openTab('coach');
    await portal.expectCoachHubView();

    await portal.openTab('hoje');
    await portal.expectTodayView();
  });

  test('aba Dieta mostra plano ou estado vazio', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.openTab('diet');
    await portal.expectDietView();

    const hasDiet = await page.getByRole('heading', { name: 'Minha dieta' }).isVisible();
    const empty = await page.getByText('Nenhuma dieta atribuída').isVisible();
    expect(hasDiet || empty).toBeTruthy();
  });
});
