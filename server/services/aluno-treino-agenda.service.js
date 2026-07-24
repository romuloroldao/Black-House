/**
 * Domínio: programação semanal de sessões de treino.
 * Sessão = ocorrência (dia) que referencia alunos_treinos — reutilizável.
 */

const repo = require('../repositories/aluno-treino-agenda.repository');

/** ISO: 1=Seg … 7=Dom (Date.getDay(): 0=Dom → 7) */
function isoDayOfWeek(date = new Date()) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function normalizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map();
  for (const item of raw) {
    const dia = Number(item?.dia_semana);
    const alunoTreinoId = item?.aluno_treino_id ? String(item.aluno_treino_id).trim() : '';
    if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
      const err = new Error('dia_semana deve ser um inteiro entre 1 (Seg) e 7 (Dom)');
      err.statusCode = 400;
      err.error_code = 'INVALID_DIA_SEMANA';
      throw err;
    }
    if (!alunoTreinoId) {
      const err = new Error('aluno_treino_id é obrigatório em cada sessão');
      err.statusCode = 400;
      err.error_code = 'MISSING_ALUNO_TREINO_ID';
      throw err;
    }
    // MVP: 1 sessão/dia — última entrada para o mesmo dia ganha
    byDay.set(dia, {
      dia_semana: dia,
      aluno_treino_id: alunoTreinoId,
      ordem: item.ordem != null ? Number(item.ordem) : 0,
    });
  }
  return Array.from(byDay.values()).sort((a, b) => a.dia_semana - b.dia_semana);
}

async function assertOwnership(pool, alunoId, sessions) {
  if (!sessions.length) return;
  const ids = [...new Set(sessions.map((s) => s.aluno_treino_id))];
  const r = await pool.query(
    `SELECT id FROM public.alunos_treinos
     WHERE aluno_id = $1
       AND COALESCE(ativo, true) = true
       AND id = ANY($2::uuid[])`,
    [alunoId, ids],
  );
  const ok = new Set(r.rows.map((row) => String(row.id)));
  for (const id of ids) {
    if (!ok.has(String(id))) {
      const err = new Error(
        'Um ou mais treinos não estão atribuídos (activos) a este aluno',
      );
      err.statusCode = 400;
      err.error_code = 'ALUNO_TREINO_NOT_OWNED';
      throw err;
    }
  }
}

async function listAgenda(pool, alunoId) {
  const rows = await repo.listByAlunoId(pool, alunoId);
  return {
    aluno_id: alunoId,
    sessions: rows.map((row) => ({
      id: row.id,
      dia_semana: row.dia_semana,
      aluno_treino_id: row.aluno_treino_id,
      treino_id: row.treino_id,
      treino_nome: row.treino_nome,
      treino_categoria: row.treino_categoria,
      treino_dificuldade: row.treino_dificuldade,
      ordem: row.ordem,
    })),
    sessoes_count: rows.length,
  };
}

async function replaceAgenda(pool, alunoId, body) {
  const sessions = normalizeSessions(body?.sessions ?? body?.sessões ?? []);
  await assertOwnership(pool, alunoId, sessions);
  await repo.replaceWeek(pool, alunoId, sessions);
  return listAgenda(pool, alunoId);
}

/**
 * Resolve o aluno_treino_id programado para a data (ou null se descanso / sem agenda).
 */
async function resolveScheduledAlunoTreinoId(pool, alunoId, date = new Date()) {
  const dia = isoDayOfWeek(date);
  const row = await repo.getByAlunoAndDia(pool, alunoId, dia);
  return row ? { dia_semana: dia, ...row } : null;
}

module.exports = {
  isoDayOfWeek,
  normalizeSessions,
  assertOwnership,
  listAgenda,
  replaceAgenda,
  resolveScheduledAlunoTreinoId,
};
