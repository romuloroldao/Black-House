import { test, expect } from '@playwright/test';
import {
  authenticateStudent,
  hasCoachCredentials,
  hasStudentCredentials,
  loginViaApi,
  requireCoachCredentials,
  requireStudentCredentials,
} from '../../helpers/auth';
import {
  createIndividualAviso,
  createStudentNotification,
  ensureConversa,
  getAlunoMe,
  loginAndUser,
  sendMessage,
  uniqueStamp,
} from '../../helpers/messaging';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Mensageria e notificações (aluno)', () => {
  test.skip(
    !hasCoachCredentials() || !hasStudentCredentials(),
    'Defina E2E_COACH_* e E2E_STUDENT_* em e2e/.env',
  );

  test('chat: vê mensagem do coach e responde', async ({ page, request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const conversa = await ensureConversa(request, coach.token, aluno.id);
    const outbound = uniqueStamp('E2E-aluno-inbox');
    await sendMessage(request, coach.token, conversa.id, outbound);

    await authenticateStudent(page, request, studentCreds.email, studentCreds.password);
    const portal = new StudentPortalPage(page);
    await portal.openCoachHub('chat');

    await expect(page.getByText(outbound, { exact: true })).toBeVisible({ timeout: 30_000 });

    const reply = uniqueStamp('E2E-aluno-reply');
    await portal.sendChatMessage(reply);
    await expect(page.getByText(reply, { exact: true })).toBeVisible();
  });

  test('avisos: vê aviso individual seeded e abre detalhe', async ({ page, request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const titulo = uniqueStamp('E2E-aluno-aviso');
    const mensagem = `Corpo do aviso ${titulo}`;
    await createIndividualAviso(request, coach.token, coach.user.id, aluno.id, {
      titulo,
      mensagem,
    });

    await authenticateStudent(page, request, studentCreds.email, studentCreds.password);
    const portal = new StudentPortalPage(page);
    await portal.openCoachHub('avisos');
    await portal.expectAvisosView();

    await expect(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByText(titulo, { exact: true }).first().click();
    await expect(page.getByText(mensagem, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('sininho: vê notificação, dispensa uma e marca todas', async ({ page, request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const tituloA = uniqueStamp('E2E-notif-A');
    const tituloB = uniqueStamp('E2E-notif-B');
    await createStudentNotification(request, coach.token, aluno.id, {
      titulo: tituloA,
      mensagem: `msg ${tituloA}`,
      tipo: 'aviso',
      link: 'messages',
    });
    await createStudentNotification(request, coach.token, aluno.id, {
      titulo: tituloB,
      mensagem: `msg ${tituloB}`,
      tipo: 'aviso',
      link: 'messages',
    });

    await authenticateStudent(page, request, studentCreds.email, studentCreds.password);
    const portal = new StudentPortalPage(page);
    await portal.expectPortalReady();
    await portal.openNotifications();

    await expect(page.getByText(tituloA, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(tituloB, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Marcar como vista' }).first().click();

    const markAll = page.getByRole('button', { name: 'Marcar todas como vistas' });
    if (await markAll.isVisible().catch(() => false)) {
      await markAll.click();
      await expect(
        page.getByText('Todas as notificações foram marcadas como vistas', { exact: true }).first(),
      ).toBeVisible({ timeout: 15_000 });
    }

    await expect(page.getByText(tituloA, { exact: true })).toHaveCount(0);
    await expect(page.getByText(tituloB, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Nenhuma notificação nova')).toBeVisible();
  });

  test('redirects legacy: tab=chat e tab=messages', async ({ page, request }) => {
    const student = requireStudentCredentials();
    await authenticateStudent(page, request, student.email, student.password);
    const portal = new StudentPortalPage(page);

    await page.goto('/portal-aluno/dashboard?tab=chat');
    await page.waitForURL(/tab=coach/);
    await portal.dismissOnboardingIfVisible();
    await expect(page).toHaveURL(/coachView=chat/);
    await portal.expectChatView();

    await page.goto('/portal-aluno/dashboard?tab=messages');
    await page.waitForURL(/tab=coach/);
    await portal.dismissOnboardingIfVisible();
    await expect(page).toHaveURL(/coachView=avisos/);
    await portal.expectAvisosView();
  });

  test('navegação Coach via bottom nav abre hub', async ({ page, request }) => {
    const student = requireStudentCredentials();
    await authenticateStudent(page, request, student.email, student.password);
    const portal = new StudentPortalPage(page);
    await portal.expectLoaded();
    await portal.openTab('coach');
    await portal.expectCoachHubView();
    await expect(page.getByRole('tab', { name: /Chat/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Avisos/ })).toBeVisible();
  });
});
