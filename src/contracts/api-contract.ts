// FIX-012 — Contrato oficial Frontend ↔ Backend (VPS)
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const API_CONTRACT = {
  auth: {
    login: () => `${API_BASE}/auth/login`,
    user: () => `${API_BASE}/auth/user`,
  },
  alunos: {
    byCoach: () => `${API_BASE}/api/alunos/by-coach`,
    me: () => `${API_BASE}/api/alunos/me`,
    list: () => `${API_BASE}/api/alunos`,
  },
  alimentos: {
    list: () => `${API_BASE}/api/alimentos`,
    byId: (alimentoId: string) => `${API_BASE}/api/alimentos/${alimentoId}`,
  },
  mensagens: {
    list: () => `${API_BASE}/api/mensagens`,
  },
  notificacoes: {
    list: () => `${API_BASE}/api/notificacoes`,
  },
  paymentPlans: {
    list: () => `${API_BASE}/api/payment-plans`,
  },
} as const;

const CONTRACT_PATTERNS = [
  '/auth/login',
  '/auth/user',
  '/api/alunos/by-coach',
  '/api/alunos/me',
  '/api/alunos',
  '/api/alimentos',
  '/api/alimentos/:id',
  '/api/mensagens',
  '/api/notificacoes',
  '/api/payment-plans',
  '/api/profiles/me',
  '/api/me',
] as const;

const CONTRACT_REGEXES = CONTRACT_PATTERNS.map((pattern) => {
  const regex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:([a-zA-Z0-9_]+)/g, '[^/]+')
    .replace(/\\\*/g, '.+');
  return new RegExp(`^${regex}$`);
});

export const normalizeEndpoint = (endpoint: string) => {
  try {
    if (endpoint.startsWith('http')) {
      const url = new URL(endpoint);
      return url.pathname;
    }
  } catch {
    // ignore invalid URL parsing
  }
  return endpoint.split('?')[0];
};

export const isContractEndpoint = (endpoint: string) => {
  const normalized = normalizeEndpoint(endpoint);
  return CONTRACT_REGEXES.some((regex) => regex.test(normalized));
};
