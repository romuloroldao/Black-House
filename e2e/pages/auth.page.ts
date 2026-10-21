import type { Page } from '@playwright/test';

export class AuthPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/auth');
    await this.page.getByRole('tab', { name: 'Entrar' }).waitFor();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.goto();
    await this.page.locator('#signin-email').fill(email);
    await this.page.locator('#signin-password').fill(password);
    await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().includes('/auth/login') && (res.status() === 401 || res.status() === 200),
      ),
      this.page.getByRole('button', { name: 'Entrar', exact: true }).click(),
    ]);
  }

  async expectSignInError(): Promise<void> {
    await this.page.waitForURL(/\/auth/);
    const inlineError = this.page.getByText(/Email ou senha incorretos|Senha incorreta/i);
    const toastError = this.page.getByText(/Erro de autenticação|Senha incorreta/i);
    await inlineError.or(toastError).first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  async openForgotPassword(): Promise<void> {
    await this.page.getByRole('button', { name: 'Esqueceu sua senha?' }).click();
    await this.page.getByRole('heading', { name: 'Esqueceu sua senha?' }).waitFor();
  }

  async submitForgotPassword(email: string): Promise<void> {
    await this.page.locator('#forgot-email').fill(email);
    await this.page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  }

  async expectForgotPasswordSuccess(email: string): Promise<void> {
    await this.page.getByRole('heading', { name: 'Email enviado!' }).waitFor({ state: 'visible' });
    await this.page.getByText(email).waitFor({ state: 'visible' });
  }
}
