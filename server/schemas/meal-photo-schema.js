/**
 * Schema Zod para resposta estruturada da análise de foto de refeição.
 * Nunca confiar em JSON cru da IA sem validação.
 */

const { z } = require('zod');

const ERROR_CODES = new Set([
  'IMAGE_NOT_MEAL',
  'LOW_QUALITY',
  'UNIDENTIFIABLE',
  'OK',
]);

function nonNegNumber(max = 20000) {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(max, n);
  }, z.number().nonnegative().max(max));
}

function optionalConfidence() {
  return z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, n));
  }, z.number().min(0).max(1).nullable());
}

const MealPhotoItemSchema = z
  .object({
    nome: z.string().min(1).max(255),
    quantidade: nonNegNumber(5000),
    unidade: z.string().max(20).default('g'),
    kcal: nonNegNumber(5000),
    ptn: nonNegNumber(500),
    cho: nonNegNumber(500),
    lip: nonNegNumber(500),
    confidence: optionalConfidence().optional(),
  })
  .passthrough();

const MealPhotoTotalsSchema = z
  .object({
    kcal: nonNegNumber(20000),
    ptn: nonNegNumber(2000),
    cho: nonNegNumber(2000),
    lip: nonNegNumber(2000),
  })
  .passthrough();

const MealPhotoAnalysisSchema = z
  .object({
    status: z
      .preprocess((v) => {
        if (v == null || v === '') return 'OK';
        return String(v).toUpperCase();
      }, z.string())
      .refine((v) => ERROR_CODES.has(v), { message: 'status inválido' }),
    error_message: z.string().max(500).nullable().optional(),
    meal_name: z.string().max(255).nullable().optional(),
    nome_sugerido: z.string().max(255).nullable().optional(),
    confidence: optionalConfidence().optional(),
    items: z.array(MealPhotoItemSchema).max(40).default([]),
    itens: z.array(MealPhotoItemSchema).max(40).optional(),
    totals: MealPhotoTotalsSchema.optional(),
    totais: MealPhotoTotalsSchema.optional(),
    uncertainties: z.array(z.string().max(500)).max(20).default([]),
    incertezas: z.array(z.string().max(500)).optional(),
  })
  .passthrough();

/**
 * Normaliza e valida a resposta da IA.
 * @param {unknown} raw
 * @returns {{
 *   status: string,
 *   error_message: string|null,
 *   nome_sugerido: string,
 *   confidence: number|null,
 *   itens: Array<object>,
 *   totais: { kcal: number, ptn: number, cho: number, lip: number },
 *   uncertainties: string[],
 * }}
 */
function parseMealPhotoAnalysis(raw) {
  const parsed = MealPhotoAnalysisSchema.parse(raw);
  const itensRaw = Array.isArray(parsed.itens) && parsed.itens.length
    ? parsed.itens
    : parsed.items || [];

  const itens = itensRaw.map((it, idx) => ({
    nome: String(it.nome).trim(),
    quantidade: Number(it.quantidade) || 0,
    unidade: String(it.unidade || 'g').trim() || 'g',
    kcal: Number(it.kcal) || 0,
    ptn: Number(it.ptn) || 0,
    cho: Number(it.cho) || 0,
    lip: Number(it.lip) || 0,
    confidence: it.confidence ?? null,
    ordem: idx,
    fonte: 'AI',
  }));

  let totais = parsed.totais || parsed.totals || null;
  if (!totais) {
    totais = itens.reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.kcal,
        ptn: acc.ptn + it.ptn,
        cho: acc.cho + it.cho,
        lip: acc.lip + it.lip,
      }),
      { kcal: 0, ptn: 0, cho: 0, lip: 0 },
    );
  } else {
    totais = {
      kcal: Number(totais.kcal) || 0,
      ptn: Number(totais.ptn) || 0,
      cho: Number(totais.cho) || 0,
      lip: Number(totais.lip) || 0,
    };
  }

  const uncertainties = [
    ...(parsed.uncertainties || []),
    ...(parsed.incertezas || []),
  ]
    .map((u) => String(u).trim())
    .filter(Boolean);

  const nome =
    (parsed.nome_sugerido || parsed.meal_name || '').trim() ||
    (itens.length ? itens.map((i) => i.nome).slice(0, 4).join(', ') : 'Refeição');

  return {
    status: parsed.status,
    error_message: parsed.error_message ? String(parsed.error_message).trim() : null,
    nome_sugerido: nome,
    confidence: parsed.confidence ?? null,
    itens,
    totais,
    uncertainties,
  };
}

function sumItemMacros(itens) {
  return (itens || []).reduce(
    (acc, it) => ({
      kcal: acc.kcal + (Number(it.kcal) || 0),
      ptn: acc.ptn + (Number(it.ptn) || 0),
      cho: acc.cho + (Number(it.cho) || 0),
      lip: acc.lip + (Number(it.lip) || 0),
    }),
    { kcal: 0, ptn: 0, cho: 0, lip: 0 },
  );
}

module.exports = {
  MealPhotoAnalysisSchema,
  MealPhotoItemSchema,
  parseMealPhotoAnalysis,
  sumItemMacros,
};
