/**
 * Ranking determinístico da carteira / inbox (Phase 5 leftover + Phase 7 fila).
 * Pesos explícitos — sem LLM.
 */

const WEIGHTS = {
  CHECKIN_PENDING: 40,
  MISS_DAY: 8,
  MISS_DAY_CAP: 40,
  MEAL_LOW: 20,
  WORKOUT_LOW: 15,
  FORM_PRIORITY: 12,
};

const MEAL_LOW_PCT = 40;
const WORKOUT_LOW_PCT = 50;
const MISS_DROP_DAYS = 3;

function attentionScore({
  checkin_pendente = false,
  miss_days_recent = 0,
  meal_pct = null,
  workout_pct = null,
  form_priority = false,
} = {}) {
  let score = 0;
  if (checkin_pendente) score += WEIGHTS.CHECKIN_PENDING;
  score += Math.min(WEIGHTS.MISS_DAY_CAP, Number(miss_days_recent || 0) * WEIGHTS.MISS_DAY);
  if (meal_pct != null && meal_pct < MEAL_LOW_PCT) score += WEIGHTS.MEAL_LOW;
  if (workout_pct != null && workout_pct < WORKOUT_LOW_PCT) score += WEIGHTS.WORKOUT_LOW;
  if (form_priority) score += WEIGHTS.FORM_PRIORITY;
  return score;
}

function isAdherenceDrop({ miss_days_recent = 0, meal_pct = null, workout_pct = null } = {}) {
  if (Number(miss_days_recent) >= MISS_DROP_DAYS) return true;
  if (meal_pct != null && meal_pct < MEAL_LOW_PCT) return true;
  if (workout_pct != null && workout_pct < WORKOUT_LOW_PCT) return true;
  return false;
}

module.exports = {
  WEIGHTS,
  MEAL_LOW_PCT,
  WORKOUT_LOW_PCT,
  MISS_DROP_DAYS,
  attentionScore,
  isAdherenceDrop,
};
