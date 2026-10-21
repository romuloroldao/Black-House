import type { APIRequestContext, Page } from '@playwright/test';
import { StudentPortalPage } from '../pages/student-portal.page';

export const API_URL =
  process.env.E2E_API_URL?.replace(/\/$/, '') ||
  process.env.VITE_API_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3001';

export function requireStudentCredentials(): { email: string; password: string } {
  const email = process.env.E2E_STUDENT_EMAIL?.trim();
  const password = process.env.E2E_STUDENT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Defina E2E_STUDENT_EMAIL e E2E_STUDENT_PASSWORD em e2e/.env (copie de e2e/.env.example).',
    );
  }
  return { email, password };
}

export function hasStudentCredentials(): boolean {
  return Boolean(process.env.E2E_STUDENT_EMAIL?.trim() && process.env.E2E_STUDENT_PASSWORD);
}

export function hasCoachCredentials(): boolean {
  return Boolean(process.env.E2E_COACH_EMAIL?.trim() && process.env.E2E_COACH_PASSWORD);
}

export function requireCoachCredentials(): { email: string; password: string } {
  const email = process.env.E2E_COACH_EMAIL?.trim();
  const password = process.env.E2E_COACH_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD em e2e/.env (copie de e2e/.env.example).',
    );
  }
  return { email, password };
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login falhou (${email}): HTTP ${res.status()} — ${body}`);
  }

  const body = (await res.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  if (!token) {
    throw new Error(`Resposta de login sem token para ${email}`);
  }
  return token;
}

export async function seedAuthToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((storedToken) => {
    localStorage.setItem('auth_token', storedToken);
  }, token);
}

/** Garante token no localStorage antes da app React montar. */
export async function authenticateViaUi(
  page: Page,
  email: string,
  password: string,
  expectPath: RegExp,
): Promise<void> {
  await page.goto('/auth');
  await page.locator('#signin-email').fill(email);
  await page.locator('#signin-password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(expectPath, { timeout: 45_000 });
}

export async function authenticateStudent(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const token = await loginViaApi(request, email, password);
  await seedAuthToken(page, token);
  await page.goto('/portal-aluno/dashboard?tab=hoje');
  const main = page.locator('#student-main-content');
  try {
    await main.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    await authenticateViaUi(page, email, password, /portal-aluno/);
    await main.waitFor({ state: 'visible', timeout: 45_000 });
  }
  const portal = new StudentPortalPage(page);
  await portal.dismissOnboardingIfVisible();
}

export async function authenticateCoach(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const token = await loginViaApi(request, email, password);
  await seedAuthToken(page, token);
  await page.goto('/?tab=dashboard');
  const welcome = page.getByText('Bem-vindo de volta!');
  try {
    await welcome.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    await authenticateViaUi(page, email, password, /\?tab=dashboard|\/$/);
    await welcome.waitFor({ state: 'visible', timeout: 45_000 });
  }
}
