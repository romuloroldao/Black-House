/**
 * Testes unitários: rotação de cardápio com calendário America/Sao_Paulo.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getRotationForDate,
  buildRotationSequence,
  resolveRotationAnchor,
} = require('../utils/diet-rotation');
const { civilDateKeyInTimeZone, civilDateAtNoonInTimeZone } = require('../utils/zoned-time');

const TZ = 'America/Sao_Paulo';

function cfg(overrides = {}) {
  return {
    rotacao_ativa: true,
    rotacao_sequencia: [
      { plano: 'A', dias: 3 },
      { plano: 'B', dias: 1 },
    ],
    rotacao_data_inicio: '2026-08-01',
    ...overrides,
  };
}

describe('diet-rotation civil calendar BR', () => {
  it('3A·1B: dia 0=A, dia 3=B, dia 4=A', () => {
    const c = cfg();
    assert.equal(buildRotationSequence(c).join(''), 'AAAB');
    assert.equal(getRotationForDate(c, new Date('2026-08-01T15:00:00-03:00'), TZ).plano, 'A');
    assert.equal(getRotationForDate(c, new Date('2026-08-02T15:00:00-03:00'), TZ).plano, 'A');
    assert.equal(getRotationForDate(c, new Date('2026-08-03T15:00:00-03:00'), TZ).plano, 'A');
    assert.equal(getRotationForDate(c, new Date('2026-08-04T15:00:00-03:00'), TZ).plano, 'B');
    assert.equal(getRotationForDate(c, new Date('2026-08-05T15:00:00-03:00'), TZ).plano, 'A');
  });

  it('virada de dia UTC vs BRT: 02:30Z em 1/set = 31/ago BRT', () => {
    const c = cfg({ rotacao_data_inicio: '2026-08-28' }); // A A A B a partir de 28
    // 28=A, 29=A, 30=A, 31=B
    const edge = new Date('2026-09-01T02:30:00.000Z'); // 23:30 BRT 31/ago
    const brKey = civilDateKeyInTimeZone(edge, TZ);
    assert.equal(brKey, '2026-08-31');
    const utcKey = edge.toISOString().slice(0, 10);
    assert.equal(utcKey, '2026-09-01');
    const rotBr = getRotationForDate(c, edge, TZ);
    assert.equal(rotBr.plano, 'B');
    // Se usássemos fatia UTC como "hoje" civil, o plano mudaria para A (dia 4 do ciclo)
    const rotUtcMistaken = getRotationForDate(
      c,
      civilDateAtNoonInTimeZone(utcKey, TZ),
      TZ,
    );
    assert.equal(rotUtcMistaken.plano, 'A');
    assert.notEqual(rotBr.plano, rotUtcMistaken.plano);
  });

  it('created_at UTC tarde BRT não desloca âncora (dia civil BR)', () => {
    // 2026-06-11T00:29:54Z = 10/06 21:29 BRT
    const c = cfg({
      rotacao_data_inicio: null,
      created_at: '2026-06-11T00:29:54.189Z',
      rotacao_sequencia: [
        { plano: 'A', dias: 3 },
        { plano: 'B', dias: 1 },
      ],
    });
    const anchor = resolveRotationAnchor(c, TZ);
    assert.equal(civilDateKeyInTimeZone(anchor, TZ), '2026-06-10');
    // slice UTC errado seria 2026-06-11
    assert.notEqual(String(c.created_at).slice(0, 10), '2026-06-10');
  });

  it('data de início no futuro: fica no 1º dia do ciclo (não envelopa)', () => {
    const c = cfg({ rotacao_data_inicio: '2026-09-20' });
    const info = getRotationForDate(c, new Date('2026-08-31T12:00:00-03:00'), TZ);
    assert.equal(info.plano, 'A');
    assert.equal(info.before_start, true);
    assert.equal(info.day_index_in_cycle, 1);
  });

  it('rotacao_data_inicio como timestamptz meia-noite BRT', () => {
    const c = cfg({ rotacao_data_inicio: '2026-08-01T03:00:00.000Z' });
    const info = getRotationForDate(c, new Date('2026-08-04T18:00:00-03:00'), TZ);
    assert.equal(info.plano, 'B');
  });
});
