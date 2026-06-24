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
}
