import type { Page } from '@playwright/test';

export class CoachPortalPage {
  constructor(private readonly page: Page) {}

  async expectDashboard(): Promise<void> {
    await this.page.getByText('Bem-vindo de volta!').waitFor({ state: 'visible' });
    await this.page.getByText('Alunos Ativos').first().waitFor({ state: 'visible' });
  }

  async openSidebarTab(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click();
    await this.page.waitForURL(new RegExp(`tab=|/financeiro`));
  }

  async openFinancialHub(): Promise<void> {
    await this.page.getByRole('button', { name: 'Financeiro' }).click();
  }

  async openFinancialSubItem(label: string): Promise<void> {
    await this.openFinancialHub();
    await this.page.getByRole('button', { name: label, exact: true }).click();
    await this.page.waitForURL(/\/financeiro/);
  }

  async expectFinancialOverview(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Visão Geral' }).waitFor({ state: 'visible' });
  }

  async expectChargesPage(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Cobranças' }).waitFor({ state: 'visible' });
  }

  async expectStudentsManager(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Gestão de Alunos' }).waitFor({
      state: 'visible',
      timeout: 20_000,
    });
  }

  async expectNutritionTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Lista de Alimentos' }).waitFor({ state: 'visible' });
  }

  async openMessages(): Promise<void> {
    await this.openSidebarTab('Mensagens');
    await this.page.waitForURL(/tab=messages/);
    await this.page.getByText('Conversas').first().waitFor({ state: 'visible' });
  }

  async openAnnouncements(): Promise<void> {
    await this.openSidebarTab('Avisos em Massa');
    await this.page.waitForURL(/tab=announcements/);
    await this.page.getByText('Envie comunicados para seus alunos e turmas').waitFor({
      state: 'visible',
    });
  }

  async startOrOpenConversationWithStudent(studentName: string): Promise<void> {
    await this.openMessages();
    const search = this.page.getByPlaceholder('Buscar conversa...');
    if (await search.isVisible().catch(() => false)) {
      await search.fill(studentName);
    }

    const existing = this.page.getByText(studentName, { exact: false }).first();
    if (await existing.isVisible().catch(() => false)) {
      await existing.click();
      await this.page.getByPlaceholder('Digite sua mensagem...').waitFor({ state: 'visible' });
      return;
    }

    await this.page.getByRole('button', { name: 'Nova' }).click();
    await this.page.getByRole('heading', { name: 'Iniciar Nova Conversa' }).waitFor({
      state: 'visible',
    });
    await this.page.getByPlaceholder('Buscar aluno...').fill(studentName);
    await this.page.getByText(studentName, { exact: false }).first().click();
    await this.page.getByPlaceholder('Digite sua mensagem...').waitFor({
      state: 'visible',
      timeout: 20_000,
    });
  }

  async sendChatMessage(text: string): Promise<void> {
    const input = this.page.getByPlaceholder('Digite sua mensagem...');
    await input.waitFor({ state: 'visible' });
    await input.fill(text);
    const sendBtn = this.page.getByRole('button', { name: 'Enviar mensagem' });
    if ((await sendBtn.count()) > 0 && (await sendBtn.isEnabled())) {
      await sendBtn.click();
    } else {
      await input.press('Enter');
    }
    await this.page.getByText(text, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  }

  async openNotifications(): Promise<void> {
    // Coach: sininho é tipicamente o primeiro botão do <main>
    const testId = this.page.getByTestId('notifications-trigger').filter({ visible: true });
    if ((await testId.count()) > 0) {
      await testId.first().click();
    } else {
      await this.page.locator('main').getByRole('button').first().click();
    }
    await this.page.getByRole('heading', { name: 'Notificações', exact: true }).waitFor({
      state: 'visible',
    });
  }

  async createIndividualAnnouncement(opts: {
    studentName: string;
    titulo: string;
    mensagem: string;
  }): Promise<void> {
    await this.openAnnouncements();
    await this.page.getByRole('button', { name: 'Novo Aviso' }).click();
    await this.page.getByRole('heading', { name: 'Criar Novo Aviso' }).waitFor({
      state: 'visible',
    });

    await this.page.locator('#individual').click();
    await this.page.locator('#titulo').fill(opts.titulo);
    await this.page.locator('#mensagem').fill(opts.mensagem);

    const studentLabel = this.page.locator('label').filter({ hasText: opts.studentName }).first();
    await studentLabel.scrollIntoViewIfNeeded();
    await studentLabel.waitFor({ state: 'visible', timeout: 20_000 });
    const forId = await studentLabel.getAttribute('for');
    if (forId) {
      await this.page.locator(`[id="${forId}"]`).click();
    } else {
      await studentLabel.click();
    }

    await this.page.getByRole('button', { name: 'Enviar Aviso' }).click();
    await this.page.getByText(/Aviso enviado/i).waitFor({ state: 'visible', timeout: 30_000 });
  }
}
