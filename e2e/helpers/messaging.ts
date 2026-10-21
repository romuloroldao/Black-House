import type { APIRequestContext } from '@playwright/test';
import { API_URL, loginViaApi } from './auth';

export type AuthUser = { id: string; email?: string };

export type AlunoMe = {
  id: string;
  nome: string;
  coach_id: string | null;
  email?: string;
};

export type Conversa = {
  id: string;
  aluno_id: string;
  coach_id: string;
  ultima_mensagem?: string | null;
};

async function apiJson<T>(
  request: APIRequestContext,
  token: string,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await request.fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: body,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok()) {
    throw new Error(`${method} ${path} → HTTP ${res.status()}: ${text.slice(0, 400)}`);
  }
  return data as T;
}

export async function loginAndUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login falhou (${email}): HTTP ${res.status()} — ${await res.text()}`);
  }
  const body = (await res.json()) as {
    token?: string;
    access_token?: string;
    user?: AuthUser;
  };
  const token = body.token ?? body.access_token;
  if (!token) throw new Error(`Login sem token para ${email}`);
  const user = body.user;
  if (!user?.id) throw new Error(`Login sem user.id para ${email}`);
  return { token, user };
}

export async function getAlunoMe(request: APIRequestContext, studentToken: string): Promise<AlunoMe> {
  return apiJson<AlunoMe>(request, studentToken, 'GET', '/api/alunos/me');
}

export async function ensureConversa(
  request: APIRequestContext,
  coachToken: string,
  alunoId: string,
): Promise<Conversa> {
  return apiJson<Conversa>(request, coachToken, 'POST', '/api/conversas', {
    aluno_id: alunoId,
  });
}

export async function sendMessage(
  request: APIRequestContext,
  token: string,
  conversaId: string,
  conteudo: string,
): Promise<{ id: string; conteudo: string }> {
  return apiJson(request, token, 'POST', '/api/mensagens', {
    conversa_id: conversaId,
    conteudo,
  });
}

export async function createStudentNotification(
  request: APIRequestContext,
  coachToken: string,
  alunoId: string,
  payload: { titulo: string; mensagem: string; tipo?: string; link?: string },
): Promise<{ id: string; titulo: string }> {
  return apiJson(request, coachToken, 'POST', '/api/notificacoes', {
    aluno_id: alunoId,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    tipo: payload.tipo ?? 'aviso',
    link: payload.link ?? 'messages',
  });
}

/** Avisos ainda passam pelo proxy legado /rest/v1. */
export async function createIndividualAviso(
  request: APIRequestContext,
  coachToken: string,
  coachUserId: string,
  alunoId: string,
  payload: { titulo: string; mensagem: string },
): Promise<{ avisoId: string; destinatarioId: string }> {
  const aviso = await apiJson<{ id: string }>(request, coachToken, 'POST', '/rest/v1/avisos', {
    coach_id: coachUserId,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    tipo: 'individual',
  });
  const dest = await apiJson<{ id: string }>(
    request,
    coachToken,
    'POST',
    '/rest/v1/avisos_destinatarios',
    {
      aviso_id: aviso.id,
      aluno_id: alunoId,
      turma_id: null,
    },
  );
  return { avisoId: aviso.id, destinatarioId: dest.id };
}

export async function seedCoachToStudentChat(
  request: APIRequestContext,
  coachEmail: string,
  coachPassword: string,
  studentEmail: string,
  studentPassword: string,
  messageText: string,
): Promise<{ conversaId: string; aluno: AlunoMe; coachUser: AuthUser }> {
  const coach = await loginAndUser(request, coachEmail, coachPassword);
  const studentToken = await loginViaApi(request, studentEmail, studentPassword);
  const aluno = await getAlunoMe(request, studentToken);
  const conversa = await ensureConversa(request, coach.token, aluno.id);
  await sendMessage(request, coach.token, conversa.id, messageText);
  return { conversaId: conversa.id, aluno, coachUser: coach.user };
}

export function uniqueStamp(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
