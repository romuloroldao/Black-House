/**
 * Serviço: substituições diárias (override do item do plano, sem mutar itens_dieta).
 */
const {
  listSubstituicoes,
  calcularSubstituicaoDireta,
  FOOD_SELECT_BASE,
} = require('./alimento-substituicoes.service');
const repo = require('../repositories/refeicao-substituicao.repository');

const FOOD_SELECT = FOOD_SELECT_BASE;

function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizePlano(plano) {
  if (plano == null || plano === '') return 'A';
  const s = String(plano).trim().toUpperCase();
  if (s === 'UNICO') return 'UNICO';
  if (/^[A-Z]$/.test(s)) return s;
  return 'A';
}

function validationError(message, code = 'VALIDATION_ERROR') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

function forbiddenError(message, code = 'FORBIDDEN') {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = code;
  return err;
}

function notFoundError(message, code = 'NOT_FOUND') {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

async function getAlimento(pool, id) {
  const r = await pool.query(`${FOOD_SELECT} WHERE a.id = $1`, [id]);
  return r.rows[0] || null;
}

async function listForAluno(pool, alunoId, { date, dietaId } = {}) {
  const dataRef = date || todayIso();
  return repo.listByAlunoAndDate(pool, alunoId, dataRef, { dietaId });
}

/**
 * Lista opções isocalóricas (reusa lógica do endpoint /alimentos/:id/substituicoes).
 */
async function listOptions(pool, { alimentoId, quantidade, unidade, limit = 20, q }) {
  const result = await listSubstituicoes(pool, {
    alimentoId,
    quantidade,
    unidade,
    limit,
    q,
  });

  const u = String(unidade || 'g').toLowerCase();
  const substituicoes = (result.substituicoes || []).map((s) => ({
    alimento_id: s.alimento.id,
    nome: s.alimento.name || s.alimento.nome,
    quantidade_equivalente: s.quantidadeEquivalente,
    unidade: u === 'un' ? 'un' : 'g',
    kcal_equivalente: s.kcalEquivalente,
    ptn_por_referencia: Number(s.alimento.protein ?? s.alimento.ptn_por_referencia) || 0,
    cho_por_referencia: Number(s.alimento.carbs ?? s.alimento.cho_por_referencia) || 0,
    lip_por_referencia: Number(s.alimento.fat ?? s.alimento.lip_por_referencia) || 0,
  }));

  return {
    referencia: {
      id: result.referencia?.id,
      nome: result.referencia?.name || result.referencia?.nome,
      tipo_id: result.referencia?.tipo_id,
    },
    quantidade_referencia: result.quantidadeReferencia,
    unidade_referencia: result.unidadeReferencia,
    kcal_referencia: result.kcalReferencia,
    substituicoes,
    mensagem: result.mensagem,
  };
}

async function applyForAluno(pool, alunoId, body) {
  const dietaId = body.dieta_id;
  const itemDietaId = body.item_dieta_id;
  const alimentoSubstitutoId = body.alimento_substituto_id;
  if (!dietaId || !itemDietaId || !alimentoSubstitutoId) {
    throw validationError('dieta_id, item_dieta_id e alimento_substituto_id são obrigatórios');
  }

  const owns = await repo.assertDietaOwnsAluno(pool, dietaId, alunoId);
  if (!owns) throw forbiddenError('Dieta não pertence a este aluno', 'DIETA_FORBIDDEN');

  const item = await repo.getItemDieta(pool, itemDietaId, dietaId);
  if (!item) throw notFoundError('Item da dieta não encontrado');

  const dataRef = body.data_ref || todayIso();
  const plano = normalizePlano(body.plano || item.plano);
  const quantidadeOriginal =
    body.quantidade_original != null ? Number(body.quantidade_original) : Number(item.quantidade);
  const unidadeOriginal = body.unidade_original || item.unidade_quantidade || 'g';

  let quantidadeSubstituto = body.quantidade_substituto;
  let unidadeSubstituto = body.unidade_substituto || unidadeOriginal;

  if (quantidadeSubstituto == null || quantidadeSubstituto === '') {
    const direct = await calcularSubstituicaoDireta(pool, {
      alimentoRefId: item.alimento_id,
      alimentoSubId: alimentoSubstitutoId,
      quantidade: quantidadeOriginal,
      unidade: unidadeOriginal,
    });
    if (!direct) {
      throw validationError('Substituto não é isocalórico válido para este alimento');
    }
    quantidadeSubstituto = direct.quantidadeEquivalente;
    unidadeSubstituto = direct.unidade;
  }

  const subFood = await getAlimento(pool, alimentoSubstitutoId);
  if (!subFood) throw notFoundError('Alimento substituto não encontrado');

  return repo.upsertSubstituicao(pool, {
    aluno_id: alunoId,
    dieta_id: dietaId,
    item_dieta_id: itemDietaId,
    data_ref: dataRef,
    plano,
    alimento_original_id: item.alimento_id,
    alimento_substituto_id: alimentoSubstitutoId,
    quantidade_original: quantidadeOriginal,
    quantidade_substituto: Number(quantidadeSubstituto),
    unidade_original: unidadeOriginal,
    unidade_substituto: unidadeSubstituto,
    origem: body.origem === 'agent' ? 'agent' : 'ui',
    metadata: body.metadata || {},
  });
}

async function clearForAluno(pool, alunoId, body) {
  const itemDietaId = body.item_dieta_id;
  if (!itemDietaId) throw validationError('item_dieta_id é obrigatório');
  const dataRef = body.data_ref || todayIso();
  const plano = normalizePlano(body.plano);
  const deleted = await repo.deleteSubstituicao(pool, alunoId, itemDietaId, dataRef, plano);
  return deleted || { cleared: true, item_dieta_id: itemDietaId };
}

module.exports = {
  todayIso,
  normalizePlano,
  listForAluno,
  listOptions,
  applyForAluno,
  clearForAluno,
};
