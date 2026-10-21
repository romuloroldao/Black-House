/**
 * Coach Knowledge — regras operacionais para o Daily Agent (Phase 6).
 */
const repo = require('../repositories/coach-rules.repository');

const DOMAINS = new Set([
  'general',
  'nutrition',
  'training',
  'checkin',
  'communication',
  'free_meal',
]);
const TRIGGERS = new Set([
  'always',
  'restaurant',
  'substitution',
  'workout',
  'late',
  'complete',
  'checkin',
]);

function validationError(message, code = 'VALIDATION_ERROR') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function notFoundError(message = 'Regra não encontrada') {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

function normalizeRuleInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.domain != null) {
    const domain = String(body.domain || 'general').trim();
    if (!DOMAINS.has(domain)) throw validationError('domain inválido');
    out.domain = domain;
  }
  if (!partial || body.trigger != null) {
    const trigger = String(body.trigger || 'always').trim();
    if (!TRIGGERS.has(trigger)) throw validationError('trigger inválido');
    out.trigger = trigger;
  }
  if (!partial || body.title != null) {
    const title = String(body.title || '').trim();
    if (!title || title.length > 120) throw validationError('title obrigatório (1–120)');
    out.title = title;
  }
  if (!partial || body.body != null) {
    const b = String(body.body || '').trim();
    if (!b || b.length > 500) throw validationError('body obrigatório (1–500)');
    out.body = b;
  }
  if (body.priority != null) {
    const p = Number(body.priority);
    if (!Number.isFinite(p) || p < 0 || p > 1000) throw validationError('priority inválida');
    out.priority = Math.round(p);
  }
  if (body.active != null) out.active = Boolean(body.active);
  if (body.source != null) out.source = String(body.source);
  if (body.source_ref !== undefined) out.source_ref = body.source_ref || null;
  return out;
}

function toAgentPayload(rows, { max = 20 } = {}) {
  return (rows || []).slice(0, max).map((r) => ({
    id: r.id,
    domain: r.domain,
    trigger: r.trigger,
    priority: r.priority,
    title: r.title,
    body: r.body,
  }));
}

/**
 * Regras activas do coach (allowlist para o agente).
 */
async function listActiveForAgent(pool, coachId, { triggers = null, limit = 20 } = {}) {
  if (!coachId) return [];
  try {
    const rows = await repo.listByCoach(pool, coachId, {
      activeOnly: true,
      triggers,
      limit: Math.max(limit, 40),
    });
    // Sempre inclui 'always' + triggers pedidos
    const filtered = Array.isArray(triggers) && triggers.length
      ? rows.filter((r) => r.trigger === 'always' || triggers.includes(r.trigger))
      : rows;
    return toAgentPayload(filtered, { max: limit });
  } catch (err) {
    if (err && err.code === '42P01') return [];
    throw err;
  }
}

/**
 * Texto curto para prefixar respostas do fast path.
 */
function formatRulesHint(rules, { max = 3 } = {}) {
  if (!Array.isArray(rules) || !rules.length) return null;
  const lines = rules.slice(0, max).map((r) => `• ${r.title}: ${r.body}`);
  return lines.join('\n');
}

async function listForCoach(pool, coachId, { includeInactive = false } = {}) {
  return repo.listByCoach(pool, coachId, {
    activeOnly: !includeInactive,
    limit: 100,
  });
}

async function createForCoach(pool, coachId, body) {
  const data = normalizeRuleInput(body || {}, { partial: false });
  return repo.insert(pool, {
    coach_id: coachId,
    ...data,
    priority: data.priority ?? 100,
    source: data.source || 'manual',
  });
}

async function updateForCoach(pool, coachId, id, body) {
  const existing = await repo.getById(pool, id, coachId);
  if (!existing) throw notFoundError();
  const patch = normalizeRuleInput(body || {}, { partial: true });
  return repo.update(pool, id, coachId, patch);
}

async function deleteForCoach(pool, coachId, id) {
  const deleted = await repo.remove(pool, id, coachId);
  if (!deleted) throw notFoundError();
  return { id: deleted.id, deleted: true };
}

/**
 * Bootstrap: se a dieta activa tiver refeicao_livre_observacao e o coach
 * ainda não tiver regra restaurant seed, cria uma.
 */
async function maybeSeedFromDieta(pool, coachId, dieta) {
  if (!coachId || !dieta?.refeicao_livre_observacao) return null;
  const obs = String(dieta.refeicao_livre_observacao).trim().slice(0, 500);
  if (!obs) return null;
  try {
    const existing = await repo.listByCoach(pool, coachId, {
      activeOnly: false,
      triggers: ['restaurant', 'always'],
      limit: 50,
    });
    if (existing.some((r) => r.source === 'seed_refeicao_livre')) return null;
    return repo.insert(pool, {
      coach_id: coachId,
      domain: 'free_meal',
      trigger: 'restaurant',
      priority: 50,
      title: 'Refeição livre',
      body: obs,
      active: true,
      source: 'seed_refeicao_livre',
      source_ref: dieta.id || null,
    });
  } catch (err) {
    if (err && err.code === '42P01') return null;
    console.warn('maybeSeedFromDieta:', err.message);
    return null;
  }
}

module.exports = {
  DOMAINS,
  TRIGGERS,
  listActiveForAgent,
  formatRulesHint,
  listForCoach,
  createForCoach,
  updateForCoach,
  deleteForCoach,
  maybeSeedFromDieta,
  toAgentPayload,
  normalizeRuleInput,
};
