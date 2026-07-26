/**
 * Estimativa simples de custo/tokens.
 */

const COST_PER_1K = {
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'llama-3.3-70b-versatile': { in: 0.00059, out: 0.00079 },
  'gemini-2.5-pro': { in: 0.00125, out: 0.01 },
  default: { in: 0.0005, out: 0.0015 },
};

function estimateTokensFromText(text) {
  const s = String(text || '');
  if (!s) return 0;
  return Math.max(1, Math.ceil(s.length / 4));
}

function estimateCostUsd({ model, tokensIn = 0, tokensOut = 0 }) {
  const rates = COST_PER_1K[model] || COST_PER_1K.default;
  return Number(
    ((tokensIn / 1000) * rates.in + (tokensOut / 1000) * rates.out).toFixed(6),
  );
}

module.exports = {
  estimateTokensFromText,
  estimateCostUsd,
};
