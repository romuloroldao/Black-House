// FIX-012 — Contrato oficial Frontend ↔ Backend (VPS, PostgreSQL + JWT)
// Alinhado a rotas reais em server/routes/api.js e server/index.js (sem Supabase/PostgREST).
// Uma base só: VITE_API_BASE_URL (explícito) ou VITE_API_URL (igual ao api-client)
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';

export const API_CONTRACT = {
  auth: {
    login: () => `${API_BASE}/auth/login`,
    user: () => `${API_BASE}/auth/user`,
  },
  alunos: {
    byCoach: () => `${API_BASE}/api/alunos/by-coach`,
    me: () => `${API_BASE}/api/alunos/me`,
    list: () => `${API_BASE}/api/alunos`,
    linkUser: () => `${API_BASE}/api/alunos/link-user`,
  },
  alimentos: {
    list: () => `${API_BASE}/api/alimentos`,
    byId: (alimentoId: string) => `${API_BASE}/api/alimentos/${alimentoId}`,
  },
  mensagens: {
    list: () => `${API_BASE}/api/mensagens`,
    byId: (id: string) => `${API_BASE}/api/mensagens/${id}`,
  },
  notificacoes: {
    list: () => `${API_BASE}/api/notificacoes`,
    byId: (id: string) => `${API_BASE}/api/notificacoes/${id}`,
  },
  paymentPlans: {
    list: () => `${API_BASE}/api/payment-plans`,
    byId: (id: string) => `${API_BASE}/api/payment-plans/${id}`,
  },
  profiles: {
    me: () => `${API_BASE}/api/profiles/me`,
  },
  identity: {
    me: () => `${API_BASE}/api/me`,
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
  },
  import: {
    parsePdf: () => `${API_BASE}/api/import/parse-pdf`,
    confirm: () => `${API_BASE}/api/import/confirm`,
  },
  payments: {
    createAsaas: () => `${API_BASE}/api/payments/create-asaas`,
  },
} as const;

/** Pathnames permitidos pelo apiClient (sem query string). Manter sincronizado com o servidor. */
const CONTRACT_PATTERNS = [
  '/auth/signup',
  '/auth/login',
  '/auth/user',
  '/auth/logout',
  '/api/alunos/by-coach',
  '/api/alunos/me',
  '/api/alunos/link-user',
  '/api/alunos',
  '/api/alimentos',
  '/api/alimentos/:id',
  '/api/mensagens',
  '/api/mensagens/:id',
  '/api/notificacoes',
  '/api/notificacoes/:id',
  '/api/payment-plans',
  '/api/payment-plans/:id',
  '/api/profiles/me',
  '/api/me',
  '/api/checkins',
  '/api/uploads/avatar',
  '/api/uploads/avatar/:userId',
  '/api/videos',
  '/api/videos/:id',
  '/api/lives',
  '/api/lives/:id',
  '/api/import/parse-pdf',
  '/api/import/confirm',
  '/api/payments/create-asaas',
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
