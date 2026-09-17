/**
 * Pesos alinhados a server/services/adherence-ranking.js
 */
export const ADHERENCE_WEIGHTS = {
  CHECKIN_PENDING: 40,
  MISS_DAY: 8,
  MISS_DAY_CAP: 40,
  MEAL_LOW: 20,
  WORKOUT_LOW: 15,
  FORM_PRIORITY: 12,
} as const;

export const MEAL_LOW_PCT = 40;
export const WORKOUT_LOW_PCT = 50;
export const MISS_DROP_DAYS = 3;

export function attentionScore(input: {
  checkin_pendente?: boolean;
  miss_days_recent?: number;
  meal_pct?: number | null;
  workout_pct?: number | null;
  form_priority?: boolean;
}): number {
  let score = 0;
  if (input.checkin_pendente) score += ADHERENCE_WEIGHTS.CHECKIN_PENDING;
  score += Math.min(
    ADHERENCE_WEIGHTS.MISS_DAY_CAP,
    Number(input.miss_days_recent || 0) * ADHERENCE_WEIGHTS.MISS_DAY,
  );
  if (input.meal_pct != null && input.meal_pct < MEAL_LOW_PCT) score += ADHERENCE_WEIGHTS.MEAL_LOW;
  if (input.workout_pct != null && input.workout_pct < WORKOUT_LOW_PCT) {
    score += ADHERENCE_WEIGHTS.WORKOUT_LOW;
  }
  if (input.form_priority) score += ADHERENCE_WEIGHTS.FORM_PRIORITY;
  return score;
}

export function isAdherenceDrop(input: {
  miss_days_recent?: number;
  meal_pct?: number | null;
  workout_pct?: number | null;
}): boolean {
  if (Number(input.miss_days_recent || 0) >= MISS_DROP_DAYS) return true;
  if (input.meal_pct != null && input.meal_pct < MEAL_LOW_PCT) return true;
  if (input.workout_pct != null && input.workout_pct < WORKOUT_LOW_PCT) return true;
  return false;
}
