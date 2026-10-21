import { test } from '@playwright/test';
import { authenticateStudent, hasStudentCredentials, requireStudentCredentials } from '../../helpers/auth';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Portal do aluno — check-in semanal', () => {
  test.skip(!hasStudentCredentials(), 'Defina E2E_STUDENT_* em e2e/.env');

  test.beforeEach(async ({ page, request }) => {
    const { email, password } = requireStudentCredentials();
    await authenticateStudent(page, request, email, password);
  });

  test('aba check-in carrega formulário ou estado já enviado', async ({ page }) => {
    const portal = new StudentPortalPage(page);
    await portal.openCheckinTab();
    await portal.expectCheckinView();
  });
});
