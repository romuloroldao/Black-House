import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { clearAuthSession } from '../../helpers/session';
import {
  API_URL,
  hasCoachCredentials,
  hasStudentCredentials,
  requireCoachCredentials,
  requireStudentCredentials,
} from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Autenticação (UI)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthSession(page);
  });

  test('aluno faz login pela UI e chega ao portal', async ({ page }) => {
    test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');
    const { email, password } = requireStudentCredentials();
    const auth = new AuthPage(page);

    await auth.signIn(email, password);
    await page.waitForURL(/portal-aluno/, { timeout: 45_000 });

    const portal = new StudentPortalPage(page);
    await portal.dismissOnboardingIfVisible();
    await portal.expectPortalReady();
    await portal.expectTodayView();
  });

  test('coach faz login pela UI e chega ao dashboard', async ({ page }) => {
    test.skip(!hasCoachCredentials(), 'Defina E2E_COACH_* em e2e/.env');
    const { email, password } = requireCoachCredentials();
    const auth = new AuthPage(page);

    await auth.signIn(email, password);
    await page.waitForURL(/tab=dashboard|\/?$/, { timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Bem-vindo de volta!/ })).toBeVisible();
    await expect(page.getByText('Alunos Ativos').first()).toBeVisible();
  });

  test('credenciais inválidas mostram erro e permanecem em /auth', async ({ page }) => {
    test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');
    const { email } = requireStudentCredentials();
    const auth = new AuthPage(page);

    await auth.signIn(email, 'senha-errada-e2e-123');
    await auth.expectSignInError();
  });

  test('aluno autenticado em / redireciona para portal-aluno', async ({ page }) => {
    test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');
    const { email, password } = requireStudentCredentials();
    const auth = new AuthPage(page);

    await auth.signIn(email, password);
    await page.waitForURL(/portal-aluno/, { timeout: 45_000 });

    await page.goto('/');
    await page.waitForURL(/portal-aluno/, { timeout: 15_000 });
  });

  test('coach/admin e portal-aluno respeitam RBAC por role', async ({ page, request }) => {
    test.skip(!hasCoachCredentials(), 'Defina E2E_COACH_* em e2e/.env');
    const { email, password } = requireCoachCredentials();
    const auth = new AuthPage(page);

    await auth.signIn(email, password);
    await page.waitForURL(/tab=dashboard|\/?$/, { timeout: 45_000 });

    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
    const userRes = await request.get(`${API_URL}/auth/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userBody = (await userRes.json()) as { role?: string };
    const role = userBody.role;

    await page.goto('/portal-aluno/dashboard?tab=hoje');

    if (role === 'admin') {
      await page.waitForURL(/portal-aluno/, { timeout: 15_000 });
      await expect(page.locator('#student-main-content')).toBeVisible();
    } else {
      await page.waitForURL(/tab=dashboard/, { timeout: 15_000 });
    }
  });

  test('esqueci senha envia pedido com sucesso', async ({ page }) => {
    test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');
    const { email } = requireStudentCredentials();
    const auth = new AuthPage(page);

    await auth.goto();
    await auth.openForgotPassword();
    await auth.submitForgotPassword(email);
    await auth.expectForgotPasswordSuccess(email);
  });
});
