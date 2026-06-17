import type { Page } from '@playwright/test';

export class CoachPortalPage {
  constructor(private readonly page: Page) {}

  async expectDashboard(): Promise<void> {
    await this.page.getByText('Bem-vindo de volta!').waitFor({ state: 'visible' });
    await this.page.getByText('Alunos Ativos').first().waitFor({ state: 'visible' });
  }

  async openSidebarTab(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, exact: true }).click();
    await this.page.waitForURL(new RegExp(`tab=`));
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
