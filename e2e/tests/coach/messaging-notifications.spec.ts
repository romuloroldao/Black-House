import { test, expect, devices } from '@playwright/test';
import {
  authenticateCoach,
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
import { CoachPortalPage } from '../../pages/coach-portal.page';
import { StudentPortalPage } from '../../pages/student-portal.page';

test.describe('Mensageria e notificações (coach)', () => {
  test.skip(
    !hasCoachCredentials() || !hasStudentCredentials(),
    'Defina E2E_COACH_* e E2E_STUDENT_* em e2e/.env',
  );

  test('abre Mensagens e envia chat ao aluno E2E', async ({ page, request }) => {
    const coach = requireCoachCredentials();
    const student = requireStudentCredentials();
    const studentToken = await loginViaApi(request, student.email, student.password);
    const aluno = await getAlunoMe(request, studentToken);

    await authenticateCoach(page, request, coach.email, coach.password);
    const portal = new CoachPortalPage(page);
    await portal.expectDashboard();
    await portal.startOrOpenConversationWithStudent(aluno.nome);

    const text = uniqueStamp('E2E-coach-chat');
    await portal.sendChatMessage(text);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  });

  test('sininho: lista notificações e marca todas como vistas', async ({ page, request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const titulo = uniqueStamp('E2E-coach-notif');
    await createStudentNotification(request, coach.token, aluno.id, {
      titulo,
      mensagem: `Notificação seeded ${titulo}`,
      tipo: 'aviso',
      link: 'messages',
    });

    await authenticateCoach(page, request, coachCreds.email, coachCreds.password);
    const portal = new CoachPortalPage(page);
    await portal.expectDashboard();
    await portal.openNotifications();

    await expect(page.getByText(titulo, { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Marcar todas como vistas' }).click();
    await expect(
      page.getByText('Todas as notificações foram marcadas como vistas', { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('histórico mostra aviso individual seeded via API', async ({ page, request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const titulo = uniqueStamp('E2E-aviso-hist');
    await createIndividualAviso(request, coach.token, coach.user.id, aluno.id, {
      titulo,
      mensagem: `Mensagem de aviso E2E ${titulo}`,
    });

    await authenticateCoach(page, request, coachCreds.email, coachCreds.password);
    const portal = new CoachPortalPage(page);
    await portal.expectDashboard();
    await portal.openAnnouncements();
    await expect(page.getByText(titulo, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('UI: formulário Novo Aviso abre com campos principais', async ({ page, request }) => {
    const coach = requireCoachCredentials();
    await authenticateCoach(page, request, coach.email, coach.password);
    const portal = new CoachPortalPage(page);
    await portal.expectDashboard();
    await portal.openAnnouncements();
    await page.getByRole('button', { name: 'Novo Aviso' }).click();
    await expect(page.getByRole('heading', { name: 'Criar Novo Aviso' })).toBeVisible();
    await expect(page.locator('#titulo')).toBeVisible();
    await expect(page.locator('#mensagem')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar Aviso' })).toBeVisible();
  });

  test('round-trip: coach envia → aluno vê e responde → coach vê resposta', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const coachCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
    });
    const studentCtx = await browser.newContext({
      ...devices['Pixel 7'],
      locale: 'pt-BR',
    });
    const coachPage = await coachCtx.newPage();
    const studentPage = await studentCtx.newPage();

    try {
      await authenticateCoach(coachPage, request, coachCreds.email, coachCreds.password);
      await authenticateStudent(studentPage, request, studentCreds.email, studentCreds.password);

      const coachPortal = new CoachPortalPage(coachPage);
      const studentPortal = new StudentPortalPage(studentPage);

      await coachPortal.startOrOpenConversationWithStudent(aluno.nome);
      const outbound = uniqueStamp('E2E-rt-coach');
      await coachPortal.sendChatMessage(outbound);

      await studentPortal.openCoachHub('chat');
      await expect(studentPage.getByText(outbound, { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      const reply = uniqueStamp('E2E-rt-aluno');
      await studentPortal.sendChatMessage(reply);

      await expect(coachPage.getByText(reply, { exact: true })).toBeVisible({
        timeout: 25_000,
      });
    } finally {
      await coachCtx.close().catch(() => undefined);
      await studentCtx.close().catch(() => undefined);
    }
  });
});

test.describe('Mensageria seed API (coach helpers)', () => {
  test.skip(
    !hasCoachCredentials() || !hasStudentCredentials(),
    'Defina E2E_COACH_* e E2E_STUDENT_* em e2e/.env',
  );

  test('API: conversa + mensagem + aviso + notificação', async ({ request }) => {
    const coachCreds = requireCoachCredentials();
    const studentCreds = requireStudentCredentials();
    const coach = await loginAndUser(request, coachCreds.email, coachCreds.password);
    const studentToken = await loginViaApi(request, studentCreds.email, studentCreds.password);
    const aluno = await getAlunoMe(request, studentToken);

    const conversa = await ensureConversa(request, coach.token, aluno.id);
    const msg = await sendMessage(
      request,
      coach.token,
      conversa.id,
      uniqueStamp('E2E-api-msg'),
    );
    expect(msg.id).toBeTruthy();

    const notif = await createStudentNotification(request, coach.token, aluno.id, {
      titulo: uniqueStamp('E2E-api-notif'),
      mensagem: 'seed api',
    });
    expect(notif.id).toBeTruthy();

    const aviso = await createIndividualAviso(
      request,
      coach.token,
      coach.user.id,
      aluno.id,
      {
        titulo: uniqueStamp('E2E-api-aviso'),
        mensagem: 'seed aviso',
      },
    );
    expect(aviso.avisoId).toBeTruthy();
    expect(aviso.destinatarioId).toBeTruthy();
  });
});
