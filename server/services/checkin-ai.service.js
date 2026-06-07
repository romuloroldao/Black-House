const aiService = require('./ai.service');
const { assertCoachCanAccessAluno } = require('./coach-team.service');

const DIGEST_KEYS = [
  'created_at',
  'beliscou_fora_plano',
  'seguiu_plano_nota',
  'apetite',
  'treinou_todas_sessoes',
  'desafiou_treinos',
  'fez_cardio',
  'seguiu_suplementacao',
  'media_horas_sono',
  'estresse_semana',
  'autoestima',
  'nao_cumpriu_porque',
  'coach_respondido_em',
];

function pickDigest(row) {
  const out = {};
  for (const key of DIGEST_KEYS) {
    if (row[key] != null && row[key] !== '') out[key] = row[key];
  }
  return out;
}

async function loadRecentCheckins(pool, alunoId, limit = 4) {
  const r = await pool.query(
    `SELECT * FROM public.weekly_checkins
     WHERE aluno_id = $1
     ORDER BY created_at DESC NULLS LAST
     LIMIT $2`,
    [alunoId, limit],
  );
  return r.rows;
}

async function trendsSummary(pool, scope, alunoId) {
  const allowed = await assertCoachCanAccessAluno(pool, scope, alunoId);
  if (!allowed) {
    const err = new Error('Sem permissão para este aluno');
    err.statusCode = 403;
    err.error_code = 'FORBIDDEN';
    throw err;
  }

  if (!aiService.isAvailable()) {
    const err = new Error('IA indisponível — configure o provider no servidor');
    err.statusCode = 503;
    err.error_code = 'AI_UNAVAILABLE';
    throw err;
  }

  const rows = await loadRecentCheckins(pool, alunoId, 4);
  if (rows.length === 0) {
    const err = new Error('Nenhum check-in encontrado para este aluno');
    err.statusCode = 404;
    err.error_code = 'NOT_FOUND';
    throw err;
  }

  const alunoRow = await pool.query('SELECT nome FROM public.alunos WHERE id = $1', [alunoId]);
  const studentName = alunoRow.rows[0]?.nome || 'Aluno';

  const systemPrompt =
    'És um assistente de coaching nutricional. Responde sempre em português (Brasil). ' +
    'Devolve apenas JSON válido com as chaves: summary (string, 3-6 frases), highlights (array de strings, 3-5 bullets).';

  const userPrompt =
    `Analisa a tendência das últimas ${rows.length} semanas de check-in do aluno "${studentName}". ` +
    'Foca adesão à dieta, treino, sono, estresse e relatos. Não inventes dados.\n\n' +
    JSON.stringify(rows.map(pickDigest), null, 2);

  const parsed = await aiService.extractStructuredData('', null, { systemPrompt, userPrompt });
  return {
    summary: String(parsed.summary || parsed.resumo || '').trim(),
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.map((h) => String(h).trim()).filter(Boolean)
      : Array.isArray(parsed.destaques)
        ? parsed.destaques.map((h) => String(h).trim()).filter(Boolean)
        : [],
    weeks_analyzed: rows.length,
    aluno_id: alunoId,
  };
}

async function draftResponse(pool, scope, checkinId, hints = '') {
  if (!aiService.isAvailable()) {
    const err = new Error('IA indisponível — configure o provider no servidor');
    err.statusCode = 503;
    err.error_code = 'AI_UNAVAILABLE';
    throw err;
  }

  const existing = await pool.query(
    `SELECT w.*, a.nome AS aluno_nome
     FROM public.weekly_checkins w
     INNER JOIN public.alunos a ON a.id = w.aluno_id
     WHERE w.id = $1`,
    [checkinId],
  );
  if (existing.rows.length === 0) {
    const err = new Error('Check-in não encontrado');
    err.statusCode = 404;
    err.error_code = 'NOT_FOUND';
    throw err;
  }

  const row = existing.rows[0];
  const allowed = await assertCoachCanAccessAluno(pool, scope, row.aluno_id);
  if (!allowed) {
    const err = new Error('Sem permissão');
    err.statusCode = 403;
    err.error_code = 'FORBIDDEN';
    throw err;
  }

  const systemPrompt =
    'És um coach humano e empático. Escreve em português (Brasil), tom profissional e acolhedor. ' +
    'Devolve JSON: { "draft": "texto da resposta em 2-4 parágrafos curtos" }. ' +
    'Não uses markdown. Referencia dados concretos do check-in.';

  const userPrompt =
    `Rascunho de feedback para ${row.aluno_nome || 'aluno'}.\n` +
    (hints ? `Instruções do coach: ${hints}\n` : '') +
    `Check-in:\n${JSON.stringify(pickDigest(row), null, 2)}`;

  const parsed = await aiService.extractStructuredData('', null, { systemPrompt, userPrompt });
  const draft = String(parsed.draft || parsed.rascunho || parsed.feedback || '').trim();
  if (!draft) {
    const err = new Error('IA não devolveu rascunho utilizável');
    err.statusCode = 502;
    err.error_code = 'AI_BAD_RESPONSE';
    throw err;
  }

  return { draft, checkin_id: checkinId, aluno_id: row.aluno_id };
}

module.exports = { trendsSummary, draftResponse };
