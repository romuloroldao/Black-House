/**
 * Domínio: refeições registadas pelo aluno.
 */

const repo = require('../repositories/refeicoes-registradas.repository');
const { sumItemMacros } = require('../schemas/meal-photo-schema');

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function macrosClose(a, b, eps = 1.5) {
  return (
    Math.abs((Number(a?.kcal) || 0) - (Number(b?.kcal) || 0)) <= eps &&
    Math.abs((Number(a?.ptn) || 0) - (Number(b?.ptn) || 0)) <= eps &&
    Math.abs((Number(a?.cho) || 0) - (Number(b?.cho) || 0)) <= eps &&
    Math.abs((Number(a?.lip) || 0) - (Number(b?.lip) || 0)) <= eps
  );
}

/**
 * Determina origem: se o utilizador alterou itens/totais vs estimativa IA → USER_ADJUSTED.
 */
function resolveOrigem({ itens, totais, aiTotais, aiItensCount, forcedOrigem }) {
  if (forcedOrigem === 'USER_ADJUSTED' || forcedOrigem === 'AI_ESTIMATE') {
    return forcedOrigem;
  }
  if (!aiTotais) return 'USER_ADJUSTED';
  const finalTotais = totais || sumItemMacros(itens);
  if (!macrosClose(finalTotais, aiTotais)) return 'USER_ADJUSTED';
  const userAdded = (itens || []).some((it) => it.fonte === 'USER');
  if (userAdded) return 'USER_ADJUSTED';
  if (aiItensCount != null && (itens || []).length !== aiItensCount) {
    return 'USER_ADJUSTED';
  }
  return 'AI_ESTIMATE';
}

async function listForAluno(pool, alunoId, opts) {
  const rows = await repo.listByAlunoId(pool, alunoId, opts);
  return repo.attachItens(pool, rows);
}

async function getForAluno(pool, id, alunoId) {
  const row = await repo.getById(pool, id);
  if (!row || row.aluno_id !== alunoId) return null;
  const itens = await repo.listItens(pool, id);
  return { ...row, itens };
}

async function createMeal(pool, alunoId, body) {
  const itens = Array.isArray(body.itens) ? body.itens : [];
  if (!itens.length && !body.notas?.trim() && !body.imagem_path) {
    const err = new Error('Adicione pelo menos um alimento ou uma descrição da refeição');
    err.statusCode = 400;
    err.error_code = 'EMPTY_MEAL';
    throw err;
  }

  const computed = sumItemMacros(itens);
  const totais = {
    kcal: round1(body.kcal != null ? body.kcal : computed.kcal),
    ptn: round1(body.ptn != null ? body.ptn : computed.ptn),
    cho: round1(body.cho != null ? body.cho : computed.cho),
    lip: round1(body.lip != null ? body.lip : computed.lip),
  };

  const aiTotais =
    body.ai_kcal != null || body.ai_ptn != null
      ? {
          kcal: Number(body.ai_kcal) || 0,
          ptn: Number(body.ai_ptn) || 0,
          cho: Number(body.ai_cho) || 0,
          lip: Number(body.ai_lip) || 0,
        }
      : null;

  const origem = resolveOrigem({
    itens,
    totais,
    aiTotais,
    aiItensCount: body.ai_itens_count,
    forcedOrigem: body.origem,
  });

  const meal = {
    aluno_id: alunoId,
    registrado_em: body.registrado_em || null,
    nome_sugerido: (body.nome_sugerido || body.nome || 'Refeição').toString().slice(0, 255),
    imagem_path: body.imagem_path || null,
    ...totais,
    ai_kcal: aiTotais?.kcal ?? null,
    ai_ptn: aiTotais?.ptn ?? null,
    ai_cho: aiTotais?.cho ?? null,
    ai_lip: aiTotais?.lip ?? null,
    origem,
    ai_confidence: body.ai_confidence ?? null,
    ai_uncertainties: Array.isArray(body.ai_uncertainties) ? body.ai_uncertainties : [],
    ai_raw: body.ai_raw ?? null,
    notas: body.notas ? String(body.notas).slice(0, 2000) : null,
  };

  const normalizedItens = itens.map((it, i) => ({
    nome: String(it.nome || '').trim().slice(0, 255) || 'Alimento',
    quantidade: Number(it.quantidade) || 0,
    unidade: String(it.unidade || 'g').slice(0, 20) || 'g',
    kcal: round1(it.kcal),
    ptn: round1(it.ptn),
    cho: round1(it.cho),
    lip: round1(it.lip),
    alimento_id: it.alimento_id || null,
    fonte: it.fonte === 'USER' ? 'USER' : 'AI',
    ordem: i,
  }));

  return repo.createWithItens(pool, meal, normalizedItens);
}

module.exports = {
  listForAluno,
  getForAluno,
  createMeal,
  resolveOrigem,
  macrosClose,
  sumItemMacros,
};
