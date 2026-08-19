/**
 * Pontuação determinística da carteira de aderência 7d (Phase 7).
 * Espelhada em src/lib/adherence-carteira-score.ts — manter pesos iguais.
 */

const SCORE_PENDING_CHECKIN = 40;
const SCORE_MISS_PER = 8;
const SCORE_MISS_CAP = 40;
const SCORE_DIET_LOW = 20;
const SCORE_WORKOUT_LOW = 15;
const DIET_LOW_THRESHOLD = 40;
const WORKOUT_LOW_THRESHOLD = 50;

/**
 * @param {{
 *   pendingCheckin?: boolean,
 *   missDays?: number,
 *   mealPct?: number | null,
 *   workoutPct?: number | null,
 * }} input
 */
function computeAdherenceAttentionScore(input = {}) {
  const pendingCheckin = Boolean(input.pendingCheckin);
  const missDays = Number.isFinite(Number(input.missDays)) ? Math.max(0, Number(input.missDays)) : 0;
  const mealPct = input.mealPct == null ? null : Number(input.mealPct);
  const workoutPct = input.workoutPct == null ? null : Number(input.workoutPct);

  let score = 0;
  const reasons = [];

  if (pendingCheckin) {
    score += SCORE_PENDING_CHECKIN;
    reasons.push('checkin_pendente');
  }

  const missScore = Math.min(SCORE_MISS_CAP, missDays * SCORE_MISS_PER);
  if (missScore > 0) {
    score += missScore;
    reasons.push('misses');
  }

  const dietLow = mealPct != null && Number.isFinite(mealPct) && mealPct < DIET_LOW_THRESHOLD;
  if (dietLow) {
    score += SCORE_DIET_LOW;
    reasons.push('dieta_baixa');
  }

  const workoutLow =
    workoutPct != null && Number.isFinite(workoutPct) && workoutPct < WORKOUT_LOW_THRESHOLD;
  if (workoutLow) {
    score += SCORE_WORKOUT_LOW;
    reasons.push('treino_baixo');
  }

  return {
    score,
    reasons,
    breakdown: {
      pending_checkin: pendingCheckin ? SCORE_PENDING_CHECKIN : 0,
      misses: missScore,
      diet_low: dietLow ? SCORE_DIET_LOW : 0,
      workout_low: workoutLow ? SCORE_WORKOUT_LOW : 0,
    },
  };
}

/** Queda de execução 7d — dieta <40%, treino <50% ou misses no período. */
function isQuedaExecucao7d(input = {}) {
  const scored = computeAdherenceAttentionScore({
    pendingCheckin: false,
    missDays: input.missDays,
    mealPct: input.mealPct,
    workoutPct: input.workoutPct,
  });
  return scored.score > 0;
}

/**
 * Ordenação determinística da inbox (maior atenção primeiro).
 * Sem LLM. Empate: prioridade de check-in, depois mais recente.
 *
 * @param {{ attentionScore: number, checkinPrioridade?: boolean, createdAt?: string }} a
 * @param {{ attentionScore: number, checkinPrioridade?: boolean, createdAt?: string }} b
 */
function compareInboxForTriagem(a, b) {
  const sa = Number(a?.attentionScore) || 0;
  const sb = Number(b?.attentionScore) || 0;
  if (sb !== sa) return sb - sa;

  const pa = a?.checkinPrioridade ? 0 : 1;
  const pb = b?.checkinPrioridade ? 0 : 1;
  if (pa !== pb) return pa - pb;

  const ta = new Date(a?.createdAt || 0).getTime();
  const tb = new Date(b?.createdAt || 0).getTime();
  const na = Number.isFinite(ta) ? ta : 0;
  const nb = Number.isFinite(tb) ? tb : 0;
  return nb - na;
}

module.exports = {
  SCORE_PENDING_CHECKIN,
  SCORE_MISS_PER,
  SCORE_MISS_CAP,
  SCORE_DIET_LOW,
  SCORE_WORKOUT_LOW,
  DIET_LOW_THRESHOLD,
  WORKOUT_LOW_THRESHOLD,
  computeAdherenceAttentionScore,
  isQuedaExecucao7d,
  compareInboxForTriagem,
};
