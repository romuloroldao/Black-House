import { test, expect } from '@playwright/test';
import { authenticateStudent, hasStudentCredentials, requireStudentCredentials } from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Agent-first home (portal aluno)', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);
  });

  test('Agent Home mostra próxima acção, composer e atalhos', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.expectTodayView();

    await expect(page.getByRole('heading', { name: /Próxima|Seguir|Treino|Refeição|Check-in|dieta/i }).or(
      page.getByText('Próxima acção'),
    ).first()).toBeVisible({ timeout: 20_000 });

    await expect(page.getByLabel('Mensagem para o agente')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Atalhos do agente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explorar plataforma' })).toBeVisible();
  });

  test('atalho do agente envia intent e mostra resposta', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.expectTodayView();

    const chip = page.getByRole('button', { name: 'O que faço agora?' });
    await chip.waitFor({ state: 'visible', timeout: 15_000 });
    await chip.click();

    await expect(page.getByText('A pensar…').or(page.getByText(/Próxima|treino|refeição|dieta|dia|plano/i).first())).toBeVisible({
      timeout: 30_000,
    });
  });

  test('navegação tradicional e retorno ao agente via FAB', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();

    await portal.openTab('diet');
    await portal.expectDietView();

    const fab = page.getByRole('button', { name: 'Voltar ao agente' });
    await fab.waitFor({ state: 'visible', timeout: 10_000 });
    await fab.click();
    await page.waitForURL(/tab=hoje/);
    await portal.expectTodayView();
    await expect(page.getByLabel('Mensagem para o agente')).toBeVisible();
  });

  test('bottom nav continua a funcionar', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.openTab('workouts');
    await portal.expectWorkoutsView();
    await portal.openTab('hoje');
    await portal.expectTodayView();
  });
});
