// FIX-013 — Mapa de disponibilidade de dados na VPS
export const dataAvailability = {
  alunosByCoach: true,
  alunosMe: true,
  alunosList: true,
  profilesMe: true,
  mensagens: true,
  notificacoes: true,
  paymentPlans: true,

  // Bases ainda NÃO existentes na VPS
  alimentos: true,
  receitas: false,
  macros: false,
} as const;

export type DataAvailabilityKey = keyof typeof dataAvailability;

export function isDataAvailable(key: DataAvailabilityKey) {
  return dataAvailability[key] === true;
}

export function getAvailabilityKeyForEndpoint(endpoint: string): DataAvailabilityKey | null {
  const normalized = endpoint.split('?')[0];

  if (normalized.startsWith('/api/alunos/by-coach')) return 'alunosByCoach';
  if (normalized.startsWith('/api/alunos/me')) return 'alunosMe';
  if (normalized === '/api/alunos') return 'alunosList';
  if (normalized.startsWith('/api/profiles/me')) return 'profilesMe';
  if (normalized.startsWith('/api/mensagens')) return 'mensagens';
  if (normalized.startsWith('/api/notificacoes')) return 'notificacoes';
  if (normalized.startsWith('/api/payment-plans')) return 'paymentPlans';
  if (normalized.startsWith('/api/alimentos')) return 'alimentos';

  return null;
}
