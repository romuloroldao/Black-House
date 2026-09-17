/**
 * Ranking + janela de aderência (sem DB)
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeAdherenceWindow,
  addDaysIso,
} = require('../services/behavioral-insight.service');
const { attentionScore, isAdherenceDrop } = require('../services/adherence-ranking');

describe('computeAdherenceWindow', () => {
  test('all meals done and rest days → high streak, zero misses', () => {
    const end = '2026-08-18';
    const mealDays = new Set();
    for (let i = 0; i < 7; i++) mealDays.add(addDaysIso(end, -i));
    const m = computeAdherenceWindow({
      days: 7,
      end,
      hasActiveDieta: true,
      mealDays,
      workoutCompletedDays: new Set(),
      agendaDias: new Set(),
    });
    assert.equal(m.rates.meal_pct, 100);
    assert.equal(m.miss_days_recent, 0);
    assert.equal(m.streak_days, 7);
  });

  test('no meals with active diet → 0% and misses on closed days', () => {
    const m = computeAdherenceWindow({
      days: 7,
      end: '2026-08-18',
      hasActiveDieta: true,
      mealDays: new Set(),
      workoutCompletedDays: new Set(),
      agendaDias: new Set(),
    });
    assert.equal(m.rates.meal_pct, 0);
    assert.equal(m.miss_days_recent, 6);
    assert.equal(m.streak_days, 0);
  });
});

describe('attentionScore', () => {
  test('pending check-in plus meal drop ranks above clean student', () => {
    const hot = attentionScore({
      checkin_pendente: true,
      miss_days_recent: 4,
      meal_pct: 20,
      workout_pct: 100,
    });
    const cold = attentionScore({
      checkin_pendente: false,
      miss_days_recent: 0,
      meal_pct: 90,
      workout_pct: 90,
    });
    assert.ok(hot > cold);
    assert.equal(cold, 0);
    assert.equal(isAdherenceDrop({ miss_days_recent: 4, meal_pct: 20 }), true);
    assert.equal(isAdherenceDrop({ miss_days_recent: 0, meal_pct: 90, workout_pct: 90 }), false);
  });
});
