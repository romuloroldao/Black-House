import { test, expect } from '@playwright/test';
import { authenticateStudent, hasStudentCredentials, requireStudentCredentials } from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Evolução do treino no portal do aluno', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);
  });

  test('métricas abrem com a leitura do Log Book acima do peso', async ({ page }) => {
    await page.goto('/portal-aluno/dashboard?tab=progress&section=metrics');
    const evolution = page.getByRole('heading', { name: 'Evolução do treino' });
    await expect(evolution).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/não evoluiu|você piorou/i)).toHaveCount(0);
    const fallback = page.getByText(/última semana com treinos/i);
    const empty = page.getByText('Precisamos de mais dados');
    await expect(fallback.or(empty).first()).toBeVisible();

    const evolutionTop = await evolution.boundingBox();
    const weight = page.getByRole('heading', { name: /Evolução do peso/i });
    if (await weight.isVisible().catch(() => false)) {
      const weightTop = await weight.boundingBox();
      expect(evolutionTop?.y ?? 0).toBeLessThan(weightTop?.y ?? 9999);
    }
    await evolution.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/evolucao-metricas.png' });
  });

  test('check-in carrega o formulário ou o estado já enviado', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.openCheckinTab();
    await portal.expectCheckinView();
  });
});
