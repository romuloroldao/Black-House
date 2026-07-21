/**
 * Acesso operacional do aluno à plataforma (independente do bloqueio financeiro).
 */

const ACESSO_VALUES = Object.freeze(['pending', 'active', 'suspended', 'revoked']);

const ERROR_BY_ACESSO = Object.freeze({
  pending: {
    error_code: 'ACCESS_PENDING',
    error: 'Acesso pendente',
    message: 'O seu coach ainda não liberou o acesso à plataforma.',
    reason: 'access_pending',
  },
  suspended: {
    error_code: 'ACCESS_SUSPENDED',
    error: 'Acesso suspenso',
    message: 'O seu acesso está temporariamente suspenso. Contacte o seu coach.',
    reason: 'access_suspended',
  },
  revoked: {
    error_code: 'ACCESS_REVOKED',
    error: 'Acesso revogado',
    message: 'O seu acesso à plataforma foi revogado. Contacte o seu coach.',
    reason: 'access_revoked',
  },
});

function normalizeAcesso(value) {
  const v = String(value || 'pending').toLowerCase();
  return ACESSO_VALUES.includes(v) ? v : 'pending';
}

function isOperacionalActive(acesso) {
  return normalizeAcesso(acesso) === 'active';
}

function operacionalBlockPayload(acesso) {
  const key = normalizeAcesso(acesso);
  if (key === 'active') return null;
  return ERROR_BY_ACESSO[key] || ERROR_BY_ACESSO.pending;
}

function isPaymentBlocking(paymentStatus) {
  return paymentStatus === 'OVERDUE' || paymentStatus === 'PENDING_AFTER_DUE_DATE';
}

function financialBlockPayload(paymentStatus) {
  if (!isPaymentBlocking(paymentStatus)) return null;
  return {
    error_code: 'PAYMENT_OVERDUE',
    error: 'Acesso bloqueado',
    message: 'Acesso bloqueado por pendências financeiras.',
    reason: 'payment_overdue',
    payment_status: paymentStatus,
  };
}

/**
 * Resolve o motivo efectivo de bloqueio (prioridade: vínculo → operacional → financeiro).
 * @returns {{ allowed: boolean, reason: string|null, error_code?: string, message?: string, acesso_operacional?: string, payment_status?: string }}
 */
function resolveEffectiveAccess({
  linked = true,
  acesso_operacional = 'pending',
  payment_status = 'CURRENT',
}) {
  if (!linked) {
    return {
      allowed: false,
      reason: 'not_linked',
      error_code: 'ALUNO_NOT_LINKED',
      message: 'Seu perfil não está vinculado a um aluno. Entre em contato com seu coach.',
      acesso_operacional: normalizeAcesso(acesso_operacional),
      payment_status,
    };
  }

  const op = operacionalBlockPayload(acesso_operacional);
  if (op) {
    return {
      allowed: false,
      reason: op.reason,
      error_code: op.error_code,
      message: op.message,
      error: op.error,
      acesso_operacional: normalizeAcesso(acesso_operacional),
      payment_status,
    };
  }

  const fin = financialBlockPayload(payment_status);
  if (fin) {
    return {
      allowed: false,
      reason: fin.reason,
      error_code: fin.error_code,
      message: fin.message,
      error: fin.error,
      acesso_operacional: 'active',
      payment_status,
    };
  }

  return {
    allowed: true,
    reason: null,
    acesso_operacional: 'active',
    payment_status: payment_status || 'CURRENT',
  };
}

const ALLOWED_TRANSITIONS = Object.freeze({
  pending: ['active', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: ['active'],
});

function canTransition(from, to) {
  const f = normalizeAcesso(from);
  const t = normalizeAcesso(to);
  if (f === t) return true;
  return (ALLOWED_TRANSITIONS[f] || []).includes(t);
}

module.exports = {
  ACESSO_VALUES,
  ERROR_BY_ACESSO,
  normalizeAcesso,
  isOperacionalActive,
  operacionalBlockPayload,
  isPaymentBlocking,
  financialBlockPayload,
  resolveEffectiveAccess,
  canTransition,
  ALLOWED_TRANSITIONS,
};
