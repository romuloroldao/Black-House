// FIX-012 — Contrato oficial Frontend ↔ Backend (VPS, PostgreSQL + JWT)
// Alinhado a rotas reais em server/routes/api.js e server/index.js (sem Supabase/PostgREST).
// Uma base só: VITE_API_BASE_URL (explícito) ou VITE_API_URL (igual ao api-client)
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

export const API_CONTRACT = {
  auth: {
    login: () => `${API_BASE}/auth/login`,
    user: () => `${API_BASE}/auth/user`,
    userById: (userId: string) =>
      `${API_BASE}/auth/user-by-id?user_id=${encodeURIComponent(userId)}`,
    confirmEmail: () => `${API_BASE}/auth/confirm-email`,
    resendConfirmation: () => `${API_BASE}/auth/resend-confirmation`,
    forgotPassword: () => `${API_BASE}/auth/forgot-password`,
    resetPassword: () => `${API_BASE}/auth/reset-password`,
    changePassword: () => `${API_BASE}/auth/change-password`,
  },
  alunos: {
    byCoach: () => `${API_BASE}/api/alunos/by-coach`,
    me: () => `${API_BASE}/api/alunos/me`,
    hoje: () => `${API_BASE}/api/alunos/me/hoje`,
    notificationPreferences: () => `${API_BASE}/api/alunos/me/notification-preferences`,
    list: () => `${API_BASE}/api/alunos`,
    linkUser: () => `${API_BASE}/api/alunos/link-user`,
    unlinkedRegistrations: () => `${API_BASE}/api/alunos/unlinked-registrations`,
    adoptRegistration: () => `${API_BASE}/api/alunos/adopt-registration`,
    portalStatus: (alunoId: string) =>
      `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/portal-status`,
  },
  alimentos: {
    list: () => `${API_BASE}/api/alimentos`,
    nutritionAudit: (query?: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams();
      if (query?.tolerancePct != null) q.set('tolerancePct', String(query.tolerancePct));
      if (query?.maxItems != null) q.set('maxItems', String(query.maxItems));
      const qs = q.toString();
      return `${API_BASE}/api/alimentos/nutrition-audit${qs ? `?${qs}` : ''}`;
    },
    byId: (alimentoId: string) => `${API_BASE}/api/alimentos/${alimentoId}`,
    gruposEquivalencia: () => `${API_BASE}/api/alimentos/grupos-equivalencia`,
    substituicoes: (
      alimentoId: string,
      query?: { quantidade?: number; unidade?: string; limit?: number },
    ) => {
      const q = new URLSearchParams();
      if (query?.quantidade != null) q.set('quantidade', String(query.quantidade));
      if (query?.unidade) q.set('unidade', query.unidade);
      if (query?.limit != null) q.set('limit', String(query.limit));
      const qs = q.toString();
      return `${API_BASE}/api/alimentos/${alimentoId}/substituicoes${qs ? `?${qs}` : ''}`;
    },
  },
  mensagens: {
    list: () => `${API_BASE}/api/mensagens`,
    byId: (id: string) => `${API_BASE}/api/mensagens/${id}`,
  },
  conversas: {
    list: () => `${API_BASE}/api/conversas`,
    byId: (id: string) => `${API_BASE}/api/conversas/${id}`,
  },
  notificacoes: {
    list: () => `${API_BASE}/api/notificacoes`,
    byId: (id: string) => `${API_BASE}/api/notificacoes/${id}`,
  },
  paymentPlans: {
    list: () => `${API_BASE}/api/payment-plans`,
    byId: (id: string) => `${API_BASE}/api/payment-plans/${id}`,
  },
  treinos: {
    list: () => `${API_BASE}/api/treinos`,
    byId: (id: string) => `${API_BASE}/api/treinos/${id}`,
  },
  profiles: {
    me: () => `${API_BASE}/api/profiles/me`,
    list: () => `${API_BASE}/api/profiles`,
  },
  identity: {
    me: () => `${API_BASE}/api/me`,
  },
  userRoles: {
    list: () => `${API_BASE}/api/user-roles`,
    byId: (id: string) => `${API_BASE}/api/user-roles/${id}`,
  },
  checkins: {
    create: () => `${API_BASE}/api/checkins`,
  },
  videos: {
    list: () => `${API_BASE}/api/videos`,
    byId: (id: string) => `${API_BASE}/api/videos/${id}`,
  },
  lives: {
    list: () => `${API_BASE}/api/lives`,
    byId: (id: string) => `${API_BASE}/api/lives/${id}`,
  },
  uploads: {
    avatar: () => `${API_BASE}/api/uploads/avatar`,
    avatarForUser: (userId: string) => `${API_BASE}/api/uploads/avatar/${userId}`,
    progressPhoto: () => `${API_BASE}/api/uploads/progress-photo`,
  },
  import: {
    parsePdf: () => `${API_BASE}/api/import/parse-pdf`,
    confirm: () => `${API_BASE}/api/import/confirm`,
    confirmDiet: () => `${API_BASE}/api/import/confirm-diet`,
    history: (params?: { aluno_id?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.aluno_id) q.set("aluno_id", params.aluno_id);
      if (params?.limit != null) q.set("limit", String(params.limit));
      const qs = q.toString();
      return `${API_BASE}/api/import/history${qs ? `?${qs}` : ""}`;
    },
  },
  payments: {
    createAsaas: () => `${API_BASE}/api/payments/create-asaas`,
  },
  asaasPayments: {
    list: () => `${API_BASE}/api/asaas-payments`,
  },
  asaasConfig: {
    list: () => `${API_BASE}/api/asaas-config`,
    byId: (id: string) => `${API_BASE}/api/asaas-config/${id}`,
    verifyConnection: () => `${API_BASE}/api/asaas-config/verify-connection`,
  },
  twilioConfig: {
    list: () => `${API_BASE}/api/twilio-config`,
    byId: (id: string) => `${API_BASE}/api/twilio-config/${id}`,
  },
  financialExceptions: {
    list: () => `${API_BASE}/api/financial-exceptions`,
    byId: (id: string) => `${API_BASE}/api/financial-exceptions/${id}`,
  },
  expenses: {
    list: () => `${API_BASE}/api/expenses`,
    byId: (id: string) => `${API_BASE}/api/expenses/${id}`,
  },
  agendaEventos: {
    list: () => `${API_BASE}/api/agenda-eventos`,
    summary: () => `${API_BASE}/api/agenda-eventos/summary`,
    attention: () => `${API_BASE}/api/agenda-eventos/attention`,
    suggestions: () => `${API_BASE}/api/agenda-eventos/suggestions`,
    snooze: (id: string) => `${API_BASE}/api/agenda-eventos/${id}/snooze`,
    byId: (id: string) => `${API_BASE}/api/agenda-eventos/${id}`,
  },
  coach: {
    notificationPreferences: () => `${API_BASE}/api/coach/me/notification-preferences`,
    teamMembers: () => `${API_BASE}/api/coach/team/members`,
    teamMemberById: (id: string) => `${API_BASE}/api/coach/team/members/${id}`,
  },
  /** Calendário de turmas (public.eventos + eventos_participantes) — ver EventsCalendar */
  eventosTurma: {
    list: () => `${API_BASE}/api/eventos`,
    byId: (id: string) => `${API_BASE}/api/eventos/${id}`,
    participantes: () => `${API_BASE}/api/eventos-participantes`,
  },
  relatorios: {
    list: () => `${API_BASE}/api/relatorios`,
    byId: (id: string) => `${API_BASE}/api/relatorios/${id}`,
  },
  relatorioFeedbacks: {
    list: (relatorioId: string) =>
      `${API_BASE}/api/relatorio-feedbacks?relatorio_id=${encodeURIComponent(relatorioId)}`,
  },
  relatorioMidias: {
    list: (relatorioId: string) =>
      `${API_BASE}/api/relatorio-midias?relatorio_id=${encodeURIComponent(relatorioId)}`,
  },
} as const;

/** Pathnames permitidos pelo apiClient (sem query string). Manter sincronizado com o servidor. */
const CONTRACT_PATTERNS = [
  '/auth/signup',
  '/auth/login',
  '/auth/user',
  '/auth/user-by-id',
  '/auth/confirm-email',
  '/auth/resend-confirmation',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',
  '/auth/logout',
  '/api/alunos/by-coach',
  '/api/alunos/:alunoId/portal-status',
  '/api/alunos/me',
  '/api/alunos/me/hoje',
  '/api/alunos/me/notification-preferences',
  '/api/alunos/link-user',
  '/api/alunos',
  '/api/alunos/:id',
  '/api/recurring-charges-config',
  '/api/recurring-charges-config/:id',
  '/api/alunos-treinos',
  '/api/alunos-treinos/:id',
  '/api/alimentos',
  '/api/alimentos/nutrition-audit',
  '/api/alimentos/:id',
  '/api/dietas',
  '/api/dietas/:id',
  '/api/feedbacks-alunos',
  '/api/feedbacks-alunos/:id',
  '/api/fotos-alunos',
  '/api/fotos-alunos/:id',
  '/api/itens-dieta',
  '/api/itens-dieta/:id',
  '/api/dieta-farmacos',
  '/api/dieta-farmacos/:id',
  '/api/mensagens',
  '/api/mensagens/:id',
  '/api/conversas',
  '/api/conversas/:id',
  '/api/notificacoes',
  '/api/notificacoes/:id',
  '/api/payment-plans',
  '/api/payment-plans/:id',
  '/api/treinos',
  '/api/treinos/:id',
  '/api/profiles/me',
  '/api/profiles',
  '/api/me',
  '/api/user-roles',
  '/api/user-roles/:id',
  '/api/checkins',
  '/api/weekly-checkins',
  '/api/uploads/avatar',
  '/api/uploads/avatar/:userId',
  '/api/uploads/progress-photo',
  '/api/uploads/storage/progress-photos/:alunoId/:filename',
  '/api/videos',
  '/api/videos/:id',
  '/api/lives',
  '/api/lives/:id',
  '/api/import/parse-pdf',
  '/api/import/confirm',
  '/api/import/confirm-diet',
  '/api/import/history',
  '/api/payments/create-asaas',
  '/api/asaas-payments',
  '/api/asaas-config',
  '/api/asaas-config/:id',
  '/api/asaas-config/verify-connection',
  '/api/twilio-config',
  '/api/twilio-config/:id',
  '/api/financial-exceptions',
  '/api/financial-exceptions/:id',
  '/api/expenses',
  '/api/expenses/:id',
  '/api/agenda-eventos',
  '/api/agenda-eventos/summary',
  '/api/agenda-eventos/attention',
  '/api/agenda-eventos/suggestions',
  '/api/agenda-eventos/:id/snooze',
  '/api/agenda-eventos/:id',
  '/api/coach/me/notification-preferences',
  '/api/coach/team/members',
  '/api/coach/team/members/:id',
  '/api/eventos',
  '/api/eventos/:id',
  '/api/eventos-participantes',
  '/api/eventos-participantes/:id',
  '/api/relatorios',
  '/api/relatorios/:id',
  '/api/relatorio-feedbacks',
  '/api/relatorio-midias',
  '/api/avisos',
  '/api/avisos/:id',
  '/api/turmas',
  '/api/turmas/:id',
  '/api/turmas-alunos',
  '/api/turmas-alunos/:id',
  '/api/avisos-destinatarios',
  '/api/avisos-destinatarios/:id',
] as const;

// :param deve virar [^/]+ ; o código antigo procurava "\:id" após o escape e nunca substituía.
const PARAM_TOKEN = '\uE000';

function contractPatternToRegExp(pattern: string): RegExp {
  const withParams = pattern.replace(/:([a-zA-Z0-9_]+)/g, PARAM_TOKEN);
  const escaped = withParams.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withGroups = escaped.split(PARAM_TOKEN).join('[^/]+');
  return new RegExp(`^${withGroups}$`);
}

const CONTRACT_REGEXES = CONTRACT_PATTERNS.map(contractPatternToRegExp);

export const normalizeEndpoint = (endpoint: string) => {
  const raw = String(endpoint ?? '').trim();
  let path = raw.split('?')[0].trim();
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      path = url.pathname;
    }
  } catch {
    // manter path derivado do split
  }
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
};

export const isContractEndpoint = (endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  return CONTRACT_REGEXES.some((regex) => regex.test(normalized));
};
