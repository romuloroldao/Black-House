import type { Page } from '@playwright/test';

export type StudentTab = 'hoje' | 'diet' | 'workouts' | 'coach';

const TAB_LABELS: Record<StudentTab, string> = {
  hoje: 'Hoje',
  diet: 'Dieta',
  workouts: 'Treino',
  coach: 'Coach',
};

export class StudentPortalPage {
  constructor(private readonly page: Page) {}

  /** Fecha tour de onboarding (bh-student-onboarding-v2) se aparecer. */
  async dismissOnboardingIfVisible(): Promise<void> {
    const skip = this.page.getByRole('button', { name: 'Saltar' });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await skip.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
    }
  }

  async expectLoaded(options?: { requireBottomNav?: boolean }): Promise<void> {
    await this.page.locator('#student-main-content').waitFor({ state: 'visible' });
    await this.dismissOnboardingIfVisible();
    if (options?.requireBottomNav !== false) {
      await this.page.getByRole('navigation', { name: 'Navegação principal' }).waitFor({
        state: 'visible',
        timeout: 15_000,
      });
    }
  }

  /** Portal carregado (desktop ou mobile) — sem exigir bottom nav. */
  async expectPortalReady(): Promise<void> {
    await this.expectLoaded({ requireBottomNav: false });
  }

  async openTab(tab: StudentTab): Promise<void> {
    const nav = this.page.getByRole('navigation', { name: 'Navegação principal' });
    if (tab === 'coach') {
      // Com badge o nome acessível vira "Coach, N mensagens novas"
      await nav.getByRole('button', { name: /^Coach/ }).click();
    } else {
      await nav.getByRole('button', { name: TAB_LABELS[tab], exact: true }).click();
    }
    await this.page.waitForURL(new RegExp(`tab=${tab}`));
  }

  async expectTodayView(): Promise<void> {
    await this.page.getByRole('heading', { level: 1 }).first().waitFor();
    const heading = await this.page.getByRole('heading', { level: 1 }).first().textContent();
    if (!heading?.match(/Bom dia|Boa tarde|Boa noite/i)) {
      throw new Error(`Esperava saudação na aba Hoje, recebeu: ${heading}`);
    }
  }

  async expectDietView(): Promise<void> {
    const dietHeading = this.page.getByRole('heading', { name: 'Minha dieta' });
    const emptyState = this.page.getByText('Nenhuma dieta atribuída');
    await dietHeading.or(emptyState).waitFor({ state: 'visible' });
  }

  async expectWorkoutsView(): Promise<void> {
    const withPlan = this.page.getByRole('heading', { name: 'Meus treinos' });
    const empty = this.page.getByText('Nenhum treino atribuído');
    await withPlan.or(empty).waitFor({ state: 'visible' });
  }

  async expectCoachHubView(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Coach', exact: true, level: 1 }).waitFor({
      state: 'visible',
    });
  }

  async openCoachHub(view: 'chat' | 'avisos' = 'chat'): Promise<void> {
    await this.page.goto(`/portal-aluno/dashboard?tab=coach&coachView=${view}`);
    await this.page.waitForURL(/tab=coach/);
    await this.dismissOnboardingIfVisible();
    await this.expectCoachHubView();
    if (view === 'avisos') {
      await this.expectAvisosView();
    } else {
      await this.expectChatView();
    }
  }

  async openCoachSubTab(view: 'chat' | 'avisos'): Promise<void> {
    const label = view === 'chat' ? /^Chat$/ : /^Avisos/;
    await this.page.getByRole('tab', { name: label }).click();
    await this.page.waitForURL(new RegExp(`coachView=${view}`));
  }

  async expectChatView(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Conversa com seu coach' }).waitFor({
      state: 'visible',
    });
  }

  async expectAvisosView(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Mensagens dos coaches', level: 1 }).waitFor({
      state: 'visible',
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
    // No mobile o sininho é o último botão do landmark banner
    const bell = this.page.getByRole('banner').getByRole('button').last();
    await bell.waitFor({ state: 'visible', timeout: 15_000 });
    await bell.click();
    await this.page.locator('h3', { hasText: 'Notificações' }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });
  }

  async openCheckinTab(): Promise<void> {
    await this.page.goto('/portal-aluno/dashboard?tab=checkin');
    await this.page.waitForURL(/tab=checkin/);
    await this.dismissOnboardingIfVisible();
  }

  async expectCheckinView(): Promise<void> {
    await this.page.getByRole('heading', { name: 'Check-in Semanal' }).waitFor({ state: 'visible' });
    const alreadySent = this.page.getByText('Check-in desta semana já enviado');
    const formRegion = this.page.getByText('Um envio por semana');
    await alreadySent.or(formRegion).waitFor({ state: 'visible' });
  }

  /**
   * Regressão: bottom nav no fluxo flex (não fixed) — último conteúdo visível ao fazer scroll.
   */
  async expectMainContentNotObscuredByBottomNav(): Promise<boolean> {
    const nav = this.page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.waitFor({ state: 'visible' });

    const isNavFixed = await nav.evaluate((el) => getComputedStyle(el).position === 'fixed');
    if (isNavFixed) return false;

    const main = this.page.locator('#student-main-content');
    await main.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    return main.evaluate((mainEl) => {
      const mainRect = mainEl.getBoundingClientRect();
      const candidates = mainEl.querySelectorAll(
        'h1, h2, h3, p.text-muted-foreground, [class*="rounded-lg"]',
      );
      const last =
        candidates.length > 0
          ? candidates[candidates.length - 1]
          : mainEl.lastElementChild;
      if (!last) return true;
      const rect = last.getBoundingClientRect();
      return rect.bottom <= mainRect.bottom + 4 && rect.top >= mainRect.top - 4;
    });
  }
}
