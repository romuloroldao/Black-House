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
    profileStatus: () => `${API_BASE}/api/alunos/me/profile-status`,
    bodyMetrics: (alunoId: string) =>
      `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/body-metrics`,
    hoje: () => `${API_BASE}/api/alunos/me/hoje`,
    treinoAgendaMe: () => `${API_BASE}/api/alunos/me/treino-agenda`,
    treinoAgenda: (alunoId: string) =>
      `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/treino-agenda`,
    notificationPreferences: () => `${API_BASE}/api/alunos/me/notification-preferences`,
    refeicaoConclusoes: (date?: string) => {
      const qs = date ? `?date=${encodeURIComponent(date)}` : '';
      return `${API_BASE}/api/alunos/me/refeicao-conclusoes${qs}`;
    },
    refeicaoSubstituicoes: (query?: { date?: string; dieta_id?: string }) => {
      const params = new URLSearchParams();
      if (query?.date) params.set('date', query.date);
      if (query?.dieta_id) params.set('dieta_id', query.dieta_id);
      const qs = params.toString();
      return `${API_BASE}/api/alunos/me/refeicao-substituicoes${qs ? `?${qs}` : ''}`;
    },
    treinoSessoes: (query?: { date?: string; treino_id?: string }) => {
      const params = new URLSearchParams();
      if (query?.date) params.set('date', query.date);
      if (query?.treino_id) params.set('treino_id', query.treino_id);
      const qs = params.toString();
      return `${API_BASE}/api/alunos/me/treino-sessoes${qs ? `?${qs}` : ''}`;
    },
    treinoSessaoById: (id: string) =>
      `${API_BASE}/api/alunos/me/treino-sessoes/${encodeURIComponent(id)}`,
    treinoSessaoSeries: (id: string) =>
      `${API_BASE}/api/alunos/me/treino-sessoes/${encodeURIComponent(id)}/series`,
    treinoCargas: (treinoId: string) =>
      `${API_BASE}/api/alunos/me/treino-cargas?treino_id=${encodeURIComponent(treinoId)}`,
    proximaAcao: (mealKeys?: string[]) => {
      const qs =
        mealKeys && mealKeys.length > 0
          ? `?meal_keys=${encodeURIComponent(mealKeys.join(','))}`
          : '';
      return `${API_BASE}/api/alunos/me/proxima-acao${qs}`;
    },
    list: () => `${API_BASE}/api/alunos`,
    linkUser: () => `${API_BASE}/api/alunos/link-user`,
    unlinkedRegistrations: () => `${API_BASE}/api/alunos/unlinked-registrations`,
    adoptRegistration: () => `${API_BASE}/api/alunos/adopt-registration`,
    portalStatus: (alunoId: string) =>
      `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/portal-status`,
    acesso: (alunoId: string) =>
      `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/acesso`,
  },
  alimentos: {
    list: (query?: { q?: string }) => {
      const params = new URLSearchParams();
      if (query?.q?.trim()) params.set('q', query.q.trim());
      const qs = params.toString();
      return `${API_BASE}/api/alimentos${qs ? `?${qs}` : ''}`;
    },
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
  foodCatalog: {
    list: (query?: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams();
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v != null && v !== '') q.set(k, String(v));
        }
      }
      const qs = q.toString();
      return `${API_BASE}/api/food-catalog${qs ? `?${qs}` : ''}`;
    },
    byId: (id: string) => `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}`,
    usage: (id: string) => `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}/usage`,
    history: (id: string, query?: { page?: number; pageSize?: number }) => {
      const q = new URLSearchParams();
      if (query?.page != null) q.set('page', String(query.page));
      if (query?.pageSize != null) q.set('pageSize', String(query.pageSize));
      const qs = q.toString();
      return `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}/history${qs ? `?${qs}` : ''}`;
    },
    versions: (id: string) => `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}/versions`,
    tipos: () => `${API_BASE}/api/food-catalog/tipos`,
    qualityReport: () => `${API_BASE}/api/food-catalog/quality-report`,
    checkDuplicate: () => `${API_BASE}/api/food-catalog/check-duplicate`,
    duplicates: (limit?: number) =>
      `${API_BASE}/api/food-catalog/duplicates${limit != null ? `?limit=${limit}` : ''}`,
    merge: (id: string) => `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}/merge`,
    create: () => `${API_BASE}/api/food-catalog`,
    update: (id: string) => `${API_BASE}/api/food-catalog/${encodeURIComponent(id)}`,
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
  weeklyCheckins: {
    list: (query?: {
      q?: string;
      limit?: number;
      offset?: number;
      com_resposta?: boolean;
      year?: number;
      aluno_id?: string;
    }) => {
      const params = new URLSearchParams();
      if (query?.q) params.set('q', query.q);
      if (query?.limit != null) params.set('limit', String(query.limit));
      if (query?.offset != null) params.set('offset', String(query.offset));
      if (query?.com_resposta) params.set('com_resposta', '1');
      if (query?.year != null) params.set('year', String(query.year));
      if (query?.aluno_id) params.set('aluno_id', query.aluno_id);
      const qs = params.toString();
      return `${API_BASE}/api/weekly-checkins${qs ? `?${qs}` : ''}`;
    },
    pendentesCount: () => `${API_BASE}/api/weekly-checkins/pendentes/count`,
    markRespondido: (id: string) => `${API_BASE}/api/weekly-checkins/${id}/respondido`,
    saveResposta: (id: string) => `${API_BASE}/api/weekly-checkins/${id}/resposta`,
    aiTrendsSummary: () => `${API_BASE}/api/weekly-checkins/ai/trends-summary`,
    aiDraftResponse: (checkinId: string) =>
      `${API_BASE}/api/weekly-checkins/${encodeURIComponent(checkinId)}/ai/draft-response`,
  },
  feedbacksAlunos: {
    list: (alunoId: string) =>
      `${API_BASE}/api/feedbacks-alunos?aluno_id=${encodeURIComponent(alunoId)}`,
    create: () => `${API_BASE}/api/feedbacks-alunos`,
    byId: (id: string) => `${API_BASE}/api/feedbacks-alunos/${encodeURIComponent(id)}`,
  },
  videos: {
    list: () => `${API_BASE}/api/videos`,
    byId: (id: string) => `${API_BASE}/api/videos/${id}`,
  },
  lives: {
    list: () => `${API_BASE}/api/lives`,
    byId: (id: string) => `${API_BASE}/api/lives/${id}`,
  },
  educationalContents: {
    list: (query?: { category?: string; q?: string; active?: boolean }) => {
      const q = new URLSearchParams();
      if (query?.category) q.set('category', query.category);
      if (query?.q) q.set('q', query.q);
      if (query?.active != null) q.set('active', String(query.active));
      const qs = q.toString();
      return `${API_BASE}/api/educational-contents${qs ? `?${qs}` : ''}`;
    },
    byId: (id: string) => `${API_BASE}/api/educational-contents/${id}`,
    create: () => `${API_BASE}/api/educational-contents`,
    update: (id: string) => `${API_BASE}/api/educational-contents/${id}`,
    delete: (id: string) => `${API_BASE}/api/educational-contents/${id}`,
  },
  uploads: {
    avatar: () => `${API_BASE}/api/uploads/avatar`,
    avatarForUser: (userId: string) => `${API_BASE}/api/uploads/avatar/${userId}`,
    progressPhoto: () => `${API_BASE}/api/uploads/progress-photo`,
    mealPhoto: () => `${API_BASE}/api/uploads/meal-photo`,
    educationalPdf: () => `${API_BASE}/api/uploads/educational-pdf`,
  },
  refeicoesRegistradas: {
    list: (params?: { limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit != null) q.set("limit", String(params.limit));
      if (params?.offset != null) q.set("offset", String(params.offset));
      const qs = q.toString();
      return `${API_BASE}/api/refeicoes-registradas${qs ? `?${qs}` : ""}`;
    },
    byId: (id: string) => `${API_BASE}/api/refeicoes-registradas/${encodeURIComponent(id)}`,
    analyze: () => `${API_BASE}/api/refeicoes-registradas/analyze`,
    create: () => `${API_BASE}/api/refeicoes-registradas`,
    byAluno: (alunoId: string, params?: { limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit != null) q.set("limit", String(params.limit));
      if (params?.offset != null) q.set("offset", String(params.offset));
      const qs = q.toString();
      return `${API_BASE}/api/alunos/${encodeURIComponent(alunoId)}/refeicoes-registradas${qs ? `?${qs}` : ""}`;
    },
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
  financialSync: {
    health: () => `${API_BASE}/api/financial/health`,
    policies: () => `${API_BASE}/api/financial/policies`,
    triggerSync: () => `${API_BASE}/api/financial/sync`,
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
    adherenceCarteira: (days?: number) => {
      const qs = days != null ? `?days=${encodeURIComponent(String(days))}` : '?days=7';
      return `${API_BASE}/api/coach/me/adherence-carteira${qs}`;
    },
    rules: (query?: { include_inactive?: boolean | string }) => {
      const params = new URLSearchParams();
      if (query?.include_inactive === true || query?.include_inactive === '1') {
        params.set('include_inactive', '1');
      }
      const qs = params.toString();
      return `${API_BASE}/api/coach/rules${qs ? `?${qs}` : ''}`;
    },
    ruleById: (id: string) => `${API_BASE}/api/coach/rules/${encodeURIComponent(id)}`,
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
  /** Phase 1b — Agent Foundation (portal aluno) */
  agent: {
    sessions: () => `${API_BASE}/api/agent/sessions`,
    currentSession: () => `${API_BASE}/api/agent/sessions/current`,
    messages: (sessionId: string) =>
      `${API_BASE}/api/agent/sessions/${encodeURIComponent(sessionId)}/messages`,
    run: (runId: string) => `${API_BASE}/api/agent/runs/${encodeURIComponent(runId)}`,
    decideApproval: (id: string) =>
      `${API_BASE}/api/agent/approvals/${encodeURIComponent(id)}/decide`,
    tools: () => `${API_BASE}/api/agent/tools`,
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
  '/api/alunos/:alunoId/acesso',
  '/api/alunos/me',
  '/api/alunos/me/profile-status',
  '/api/alunos/me/hoje',
  '/api/alunos/me/treino-agenda',
  '/api/alunos/me/refeicao-conclusoes',
  '/api/alunos/me/refeicao-substituicoes',
  '/api/alunos/me/treino-sessoes',
  '/api/alunos/me/treino-sessoes/:id',
  '/api/alunos/me/treino-sessoes/:id/series',
  '/api/alunos/me/treino-cargas',
  '/api/alunos/me/proxima-acao',
  '/api/agent/sessions',
  '/api/agent/sessions/current',
  '/api/agent/sessions/:id/messages',
  '/api/agent/runs/:id',
  '/api/agent/approvals/:id/decide',
  '/api/agent/tools',
  '/api/alunos/:alunoId/treino-agenda',
  '/api/alunos/:alunoId/body-metrics',
  '/api/alunos/me/notification-preferences',
  '/api/alunos/link-user',
  '/api/alunos/unlinked-registrations',
  '/api/alunos/adopt-registration',
  '/api/alunos/dismiss-registration',
  '/api/alunos',
  '/api/alunos/:id',
  '/api/recurring-charges-config',
  '/api/recurring-charges-config/:id',
  '/api/alunos-treinos',
  '/api/alunos-treinos/assign',
  '/api/alunos-treinos/:id',
  '/api/alunos-treinos/:id/treino-resolvido',
  '/api/alunos-treinos/:id/personalizacao',
  '/api/alimentos',
  '/api/alimentos/nutrition-audit',
  '/api/alimentos/:id',
  '/api/alimentos/:id/substituicoes',
  '/api/food-catalog',
  '/api/food-catalog/quality-report',
  '/api/food-catalog/tipos',
  '/api/food-catalog/duplicates',
  '/api/food-catalog/:id/merge',
  '/api/food-catalog/:id',
  '/api/food-catalog/:id/usage',
  '/api/food-catalog/:id/history',
  '/api/food-catalog/:id/versions',
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
  '/api/treinos/:id/atribuicoes',
  '/api/profiles/me',
  '/api/profiles',
  '/api/me',
  '/api/user-roles',
  '/api/user-roles/:id',
  '/api/checkins',
  '/api/weekly-checkins',
  '/api/weekly-checkins/ai/trends-summary',
  '/api/weekly-checkins/:id/ai/draft-response',
  '/api/weekly-checkins/:id/respondido',
  '/api/weekly-checkins/:id/resposta',
  '/api/weekly-checkins/pendentes/count',
  '/api/uploads/avatar',
  '/api/uploads/avatar/:userId',
  '/api/uploads/progress-photo',
  '/api/uploads/meal-photo',
  '/api/uploads/storage/progress-photos/:alunoId/:filename',
  '/api/uploads/storage/meal-photos/:alunoId/:filename',
  '/api/refeicoes-registradas',
  '/api/refeicoes-registradas/analyze',
  '/api/refeicoes-registradas/:id',
  '/api/alunos/:alunoId/refeicoes-registradas',
  '/api/videos',
  '/api/videos/:id',
  '/api/educational-contents',
  '/api/educational-contents/:id',
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
  '/api/financial/health',
  '/api/financial/policies',
  '/api/financial/sync',
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
  '/api/coach/me/adherence-carteira',
  '/api/coach/rules',
  '/api/coach/rules/:id',
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
