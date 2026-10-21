const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { MILESTONES } = require('../services/smart-reminder/types');
const checkinWeekly = require('../services/smart-reminder/domains/checkin-weekly');
const { weekKeyInTimeZone, localDateTimeToUtc } = require('../utils/zoned-time');

describe('smart-reminder checkin-weekly', () => {
  test('flowCycleId é determinístico', () => {
    const a = checkinWeekly.flowCycleId('aluno-1', '2026-06-23');
    const b = checkinWeekly.flowCycleId('aluno-1', '2026-06-23');
    const c = checkinWeekly.flowCycleId('aluno-1', '2026-06-30');
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  test('buildEntityId e parseEntityId', () => {
    const entityId = checkinWeekly.buildEntityId('uuid-1', '2026-06-23');
    assert.equal(entityId, 'uuid-1:2026-06-23');
    assert.deepEqual(checkinWeekly.parseEntityId(entityId), {
      alunoId: 'uuid-1',
      weekKey: '2026-06-23',
    });
  });

  test('INITIAL agenda segunda 10h em São Paulo', () => {
    const scheduled = checkinWeekly.getMilestoneSchedule({
      weekStartParts: { year: 2026, month: 6, day: 23 },
      timeZone: 'America/Sao_Paulo',
      milestone: MILESTONES.INITIAL,
    });
    assert.equal(scheduled.toISOString(), '2026-06-23T13:00:00.000Z');
  });

  test('PRE_DEADLINE_2H agenda domingo 21h em São Paulo', () => {
    const scheduled = checkinWeekly.getMilestoneSchedule({
      weekStartParts: { year: 2026, month: 6, day: 23 },
      timeZone: 'America/Sao_Paulo',
      milestone: MILESTONES.PRE_DEADLINE_2H,
    });
    assert.equal(scheduled.toISOString(), '2026-06-30T00:00:00.000Z');
  });

  test('weekKeyInTimeZone usa segunda-feira', () => {
    const wed = new Date('2026-06-25T15:00:00.000Z');
    assert.equal(weekKeyInTimeZone(wed, 'America/Sao_Paulo'), '2026-06-22');
  });
});

describe('zoned-time localDateTimeToUtc', () => {
  test('converte horário local SP para UTC', () => {
    const utc = localDateTimeToUtc(
      { year: 2026, month: 6, day: 23, hour: 10, minute: 0 },
      'America/Sao_Paulo',
    );
    assert.equal(utc.toISOString(), '2026-06-23T13:00:00.000Z');
  });
});
