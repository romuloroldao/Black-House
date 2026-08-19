/**
 * Pontuação determinística da carteira de aderência 7d (Phase 7).
 * Espelhada em server/services/adherence-carteira-score.js — manter pesos iguais.
 */

export const SCORE_PENDING_CHECKIN = 40;
export const SCORE_MISS_PER = 8;
export const SCORE_MISS_CAP = 40;
export const SCORE_DIET_LOW = 20;
export const SCORE_WORKOUT_LOW = 15;
export const DIET_LOW_THRESHOLD = 40;
export const WORKOUT_LOW_THRESHOLD = 50;

export type AdherenceScoreInput = {
  pendingCheckin?: boolean;
  missDays?: number;
  mealPct?: number | null;
  workoutPct?: number | null;
};

export type AdherenceAttentionScore = {
  score: number;
  reasons: string[];
  breakdown: {
    pending_checkin: number;
    misses: number;
    diet_low: number;
    workout_low: number;
  };
};

export function computeAdherenceAttentionScore(
  input: AdherenceScoreInput = {},
): AdherenceAttentionScore {
  const pendingCheckin = Boolean(input.pendingCheckin);
  const missDays = Number.isFinite(Number(input.missDays)) ? Math.max(0, Number(input.missDays)) : 0;
  const mealPct = input.mealPct == null ? null : Number(input.mealPct);
  const workoutPct = input.workoutPct == null ? null : Number(input.workoutPct);

  let score = 0;
  const reasons: string[] = [];

  if (pendingCheckin) {
    score += SCORE_PENDING_CHECKIN;
    reasons.push("checkin_pendente");
  }

  const missScore = Math.min(SCORE_MISS_CAP, missDays * SCORE_MISS_PER);
  if (missScore > 0) {
    score += missScore;
    reasons.push("misses");
  }

  const dietLow = mealPct != null && Number.isFinite(mealPct) && mealPct < DIET_LOW_THRESHOLD;
  if (dietLow) {
    score += SCORE_DIET_LOW;
    reasons.push("dieta_baixa");
  }

  const workoutLow =
    workoutPct != null && Number.isFinite(workoutPct) && workoutPct < WORKOUT_LOW_THRESHOLD;
  if (workoutLow) {
    score += SCORE_WORKOUT_LOW;
    reasons.push("treino_baixo");
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
export function isQuedaExecucao7d(input: AdherenceScoreInput = {}): boolean {
  const scored = computeAdherenceAttentionScore({
    pendingCheckin: false,
    missDays: input.missDays,
    mealPct: input.mealPct,
    workoutPct: input.workoutPct,
  });
  return scored.score > 0;
}
