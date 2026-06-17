import { test, expect } from '@playwright/test';
import { authenticateStudent, hasStudentCredentials, requireStudentCredentials } from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Portal do aluno — regressão scroll Dieta (mobile)', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);
  });

  test('conteúdo da Dieta não fica tapado pela bottom nav ao scroll', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.openTab('diet');
    await portal.expectDietView();

    const notObscured = await portal.expectMainContentNotObscuredByBottomNav();
    expect(notObscured).toBe(true);
  });
});
