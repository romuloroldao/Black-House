import { test, expect } from '@playwright/test';
import {
  authenticateStudent,
  hasStudentCredentials,
  requireStudentCredentials,
  API_URL,
  loginViaApi,
} from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Onboarding contextual do aluno', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test('API: preferências isoladas por onboarding_id', async ({ request }) => {
    const { email, password } = requireStudentCredentials();
    const token = await loginViaApi(request, email, password);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const putA = await request.put(`${API_URL}/api/alunos/me/onboarding-preferences`, {
      headers,
      data: {
        onboarding_id: 'e2e-tutorial-a',
        version: 1,
        state: 'dismissed_permanently',
        current_step: 0,
      },
    });
    expect(putA.ok()).toBeTruthy();

    const putB = await request.put(`${API_URL}/api/alunos/me/onboarding-preferences`, {
      headers,
      data: {
        onboarding_id: 'e2e-tutorial-b',
        version: 1,
        state: 'completed',
        current_step: 1,
      },
    });
    expect(putB.ok()).toBeTruthy();

    const list = await request.get(`${API_URL}/api/alunos/me/onboarding-preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      items: Array<{ onboarding_id: string; state: string; dismiss_permanently: boolean }>;
    };
    const a = body.items.find((i) => i.onboarding_id === 'e2e-tutorial-a');
    const b = body.items.find((i) => i.onboarding_id === 'e2e-tutorial-b');
    expect(a?.state).toBe('dismissed_permanently');
    expect(a?.dismiss_permanently).toBe(true);
    expect(b?.state).toBe('completed');
    expect(b?.dismiss_permanently).toBe(false);
  });

  test('UI: painel pode ser pulado e não bloqueia a navegação', async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);

    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();

    // Se o painel aparecer, Pular deve fechar sem impedir a aba Hoje.
    await portal.dismissOnboardingIfVisible();
    await portal.expectTodayView();

    await portal.openTab('workouts');
    await portal.expectWorkoutsView();
    await portal.dismissOnboardingIfVisible();

    // Ajuda contextual (reabrir) não deve quebrar a tela.
    const help = page.getByRole('button', { name: /Como (usar|treinar)/i });
    if (await help.first().isVisible().catch(() => false)) {
      await help.first().click();
      await expect(page.getByRole('button', { name: 'Pular' })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Não ver de novo' }).click();
    }

    await expect(page.locator('#student-main-content')).toBeVisible();
  });
});
