/**
 * Variações de preparo: mesmos alimentos e mesmas quantidades da prescrição.
 * O texto descreve a técnica. Os macros saem do catálogo, não de um modelo.
 */

const crypto = require('crypto');

const FORBIDDEN_EXTRAS = [
  'azeite',
  'manteiga',
  'queijo',
  'molho',
  'oleo',
  'óleo',
  'creme de leite',
  'maionese',
  'açúcar',
  'acucar',
];

function roundQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

function isSubstitutoRefeicao(refeicao) {
  return /\(\s*substituto\s*\)/i.test(String(refeicao || ''));
}

function mealKeyFromRefeicao(refeicao) {
  let base = String(refeicao || '').trim();
  base = base.replace(/\s*\(\s*substituto\s*\)\s*$/i, '').trim();
  const paren = base.match(/\s*\(([^)]+)\)\s*$/);
  if (paren && /\bplano\s*[a-z]\b/i.test(paren[1])) {
    base = base.slice(0, paren.index).trim();
  }
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function fingerprintItems(items) {
  const rows = (items || [])
    .filter((item) => item && item.alimento_id && !isSubstitutoRefeicao(item.refeicao))
    .map((item) => ({
      alimento_id: String(item.alimento_id),
      quantidade: roundQty(item.quantidade),
      unidade: String(item.unidade_quantidade || item.unidade || 'g').toLowerCase(),
    }))
    .sort((a, b) => (
      a.alimento_id.localeCompare(b.alimento_id)
      || a.quantidade - b.quantidade
      || a.unidade.localeCompare(b.unidade)
    ));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function prescribedNames(items) {
  return (items || [])
    .map((item) => String(item.nome || item.alimento_nome_snapshot || '').toLowerCase())
    .join(' ');
}

function mentionsForbiddenExtra(text, items) {
  const haystack = String(text || '').toLowerCase();
  const names = prescribedNames(items);
  return FORBIDDEN_EXTRAS.some((word) => haystack.includes(word) && !names.includes(word));
}

function eligibleForVariation(items) {
  const principais = (items || []).filter(
    (item) => item && item.alimento_id && !isSubstitutoRefeicao(item.refeicao),
  );
  if (principais.length < 2) return false;
  const blob = principais
    .map((item) => `${item.nome || ''} ${item.refeicao || ''}`)
    .join(' ')
    .toLowerCase();
  if (/\b(whey|suplemento|cápsula|capsula|fármaco|farmaco)\b/.test(blob) && principais.length < 3) {
    return false;
  }
  return true;
}

function buildTemplateVariations(items) {
  const principais = (items || []).filter(
    (item) => item && item.alimento_id && !isSubstitutoRefeicao(item.refeicao),
  );
  const nomes = principais
    .map((item) => item.nome || item.alimento_nome_snapshot || 'alimento')
    .join(', ');
  const frozen = principais.map((item) => ({
    alimento_id: String(item.alimento_id),
    nome: item.nome || item.alimento_nome_snapshot || '',
    quantidade: roundQty(item.quantidade),
    unidade: String(item.unidade_quantidade || item.unidade || 'g').toLowerCase(),
  }));

  return [
    {
      indice: 1,
      titulo: 'Na frigideira',
      preparo: `Prepare ${nomes} na frigideira, mantendo exatamente as quantidades da prescrição.`,
      itens: frozen,
    },
    {
      indice: 2,
      titulo: 'No forno',
      preparo: `Asse ${nomes} no forno, sem mudar as quantidades prescritas pelo coach.`,
      itens: frozen,
    },
  ];
}

function sameItem(a, b) {
  return (
    String(a.alimento_id) === String(b.alimento_id)
    && roundQty(a.quantidade) === roundQty(b.quantidade)
    && String(a.unidade || a.unidade_quantidade || 'g').toLowerCase()
      === String(b.unidade || b.unidade_quantidade || 'g').toLowerCase()
  );
}

function validateVariation(prescribed, variation) {
  const principais = (prescribed || []).filter(
    (item) => item && item.alimento_id && !isSubstitutoRefeicao(item.refeicao),
  );
  const offered = variation?.itens || [];
  if (!variation?.titulo || !variation?.preparo) {
    return { ok: false, reason: 'TEXTO_VAZIO' };
  }
  if (offered.length !== principais.length) {
    return { ok: false, reason: 'CONTAGEM_DIFERENTE' };
  }
  const left = [...offered];
  for (const item of principais) {
    const idx = left.findIndex((candidate) => sameItem(item, candidate));
    if (idx < 0) return { ok: false, reason: 'ITEM_DIVERGENTE' };
    left.splice(idx, 1);
  }
  if (mentionsForbiddenExtra(`${variation.titulo} ${variation.preparo}`, principais)) {
    return { ok: false, reason: 'INGREDIENTE_EXTRA' };
  }
  return { ok: true };
}

function macrosOf(items) {
  return (items || []).reduce(
    (acc, item) => {
      const qty = roundQty(item.quantidade);
      const portion = Number(item.quantidade_referencia_g) > 0 ? Number(item.quantidade_referencia_g) : 100;
      const unit = String(item.unidade_quantidade || item.unidade || 'g').toLowerCase();
      const factor = unit === 'un' ? qty : qty / portion;
      acc.kcal += (Number(item.kcal_por_referencia) || 0) * factor;
      acc.ptn += (Number(item.ptn_por_referencia) || 0) * factor;
      acc.cho += (Number(item.cho_por_referencia) || 0) * factor;
      acc.lip += (Number(item.lip_por_referencia) || 0) * factor;
      return acc;
    },
    { kcal: 0, ptn: 0, cho: 0, lip: 0 },
  );
}

module.exports = {
  roundQty,
  isSubstitutoRefeicao,
  mealKeyFromRefeicao,
  fingerprintItems,
  eligibleForVariation,
  buildTemplateVariations,
  validateVariation,
  mentionsForbiddenExtra,
  macrosOf,
};
