/**
 * Helpers do guia visual de check-in (slots de pose).
 * Espelho leve das funções em src/lib/checkin-weekly-rules.ts.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const CHECKIN_PHOTO_POSES = ['frente', 'costas', 'lado_esquerdo', 'lado_direito'];
const CHECKIN_PHOTO_SLOTS = CHECKIN_PHOTO_POSES.map((pose, index) => ({ pose, index }));

function fillCheckinPhotoSlots(current, incoming) {
  const byPose = new Map();
  for (const draft of current) {
    if (draft.descricao && CHECKIN_PHOTO_POSES.includes(draft.descricao)) {
      byPose.set(draft.descricao, draft);
    }
  }
  let incomingIdx = 0;
  for (const slot of CHECKIN_PHOTO_SLOTS) {
    if (byPose.has(slot.pose)) continue;
    if (incomingIdx >= incoming.length) break;
    const next = incoming[incomingIdx++];
    byPose.set(slot.pose, { ...next, descricao: slot.pose });
  }
  return CHECKIN_PHOTO_SLOTS.map((slot) => byPose.get(slot.pose)).filter(Boolean);
}

describe('fillCheckinPhotoSlots', () => {
  test('preenche slots vazios em ordem canónica', () => {
    const out = fillCheckinPhotoSlots(
      [],
      [
        { id: 'a', file: {} },
        { id: 'b', file: {} },
      ],
    );
    assert.equal(out.length, 2);
    assert.equal(out[0].descricao, 'frente');
    assert.equal(out[1].descricao, 'costas');
    assert.equal(out[0].id, 'a');
  });

  test('preserva slots já preenchidos', () => {
    const out = fillCheckinPhotoSlots(
      [{ id: 'frente1', descricao: 'frente', file: {} }],
      [{ id: 'novo', file: {} }],
    );
    assert.equal(out.length, 2);
    assert.equal(out[0].id, 'frente1');
    assert.equal(out[1].descricao, 'costas');
    assert.equal(out[1].id, 'novo');
  });
});
