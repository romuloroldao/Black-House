/**
 * Testes unitários — foto-pose.engine.js
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../services/foto-pose.engine');

describe('resolveEffectivePose', () => {
  test('caso 1: coach override tem prioridade', () => {
    const r = engine.resolveEffectivePose({
      pose_coach: 'costas',
      pose_vision: 'frente',
      pose_vision_confidence: 0.99,
    });
    assert.equal(r.pose, 'costas');
    assert.equal(r.source, 'coach');
  });

  test('caso 2: vision alta confiança', () => {
    const r = engine.resolveEffectivePose({
      pose_vision: 'frente',
      pose_vision_confidence: 0.9,
    });
    assert.equal(r.pose, 'frente');
    assert.equal(r.source, 'vision');
    assert.equal(r.needs_review, false);
  });

  test('caso 3: vision confiança média — needs_review', () => {
    const r = engine.resolveEffectivePose({
      pose_vision: 'costas',
      pose_vision_confidence: 0.7,
    });
    assert.equal(r.pose, 'costas');
    assert.equal(r.needs_review, true);
  });

  test('caso 4: vision baixa confiança → desconhecido', () => {
    const r = engine.resolveEffectivePose({
      pose_vision: 'frente',
      pose_vision_confidence: 0.4,
    });
    assert.equal(r.pose, 'desconhecido');
    assert.equal(r.comparable, false);
  });

  test('caso 5: invalido não comparável', () => {
    const r = engine.resolveEffectivePose({
      pose_vision: 'invalido',
      pose_vision_confidence: 0.95,
    });
    assert.equal(r.pose, 'invalido');
    assert.equal(r.comparable, false);
  });

  test('caso 6: pose_aluno ignorada', () => {
    const r = engine.resolveEffectivePose({
      pose_aluno: 'frente',
      descricao: 'frente',
      pose_analysis_status: 'pending',
    });
    assert.equal(r.pose, 'desconhecido');
    assert.equal(r.source, 'unknown');
  });

  test('caso 7: legado descricao ignorado (tags de aluno não fiáveis)', () => {
    const r = engine.resolveEffectivePose({
      descricao: 'lado_esquerdo',
      pose_analysis_status: 'classified',
      pose_source: 'student',
    });
    assert.equal(r.pose, 'desconhecido');
    assert.equal(r.source, 'unknown');
  });
});

describe('buildPoseRecordFromVision', () => {
  test('caso 8: multi-pessoa → invalido', () => {
    const patch = engine.buildPoseRecordFromVision(
      { pose: 'frente', confidence: 0.9, people_count: 2, suitable_for_compare: false },
      {},
    );
    assert.equal(patch.pose_vision, 'invalido');
    assert.equal(patch.pose_efetiva, 'invalido');
  });

  test('caso 9: normalizePose mapeia incerto', () => {
    assert.equal(engine.normalizePose('incerto'), 'desconhecido');
    assert.equal(engine.normalizePose('FRONT'), 'frente');
  });
});

describe('pickBestPhotoForPose', () => {
  test('caso 10: desempate coach > confidence', () => {
    const photos = [
      {
        id: 'a',
        pose_efetiva: 'frente',
        pose_source: 'vision',
        pose_vision_confidence: 0.95,
        created_at: '2026-01-02',
      },
      {
        id: 'b',
        pose_efetiva: 'frente',
        pose_source: 'coach',
        pose_coach: 'frente',
        created_at: '2026-01-01',
      },
    ];
    const best = engine.pickBestPhotoForPose(photos, 'frente');
    assert.equal(best.id, 'b');
  });

  test('exclui invalido e desconhecido', () => {
    const photos = [
      { id: 'x', pose_efetiva: 'invalido', pose_source: 'vision' },
      { id: 'y', pose_efetiva: 'frente', pose_source: 'vision', pose_vision_confidence: 0.8 },
    ];
    assert.equal(engine.pickBestPhotoForPose(photos, 'frente')?.id, 'y');
  });
});

describe('acceptClientPose', () => {
  test('aceita pose comparável acima do limiar', () => {
    assert.deepEqual(engine.acceptClientPose({ pose: 'lado_esquerdo', confidence: 0.9 }, 0.8), {
      pose: 'lado_esquerdo',
      confidence: 0.9,
    });
  });

  test('rejeita abaixo do limiar, fora de 0..1 ou sem confiança', () => {
    assert.equal(engine.acceptClientPose({ pose: 'frente', confidence: 0.79 }, 0.8), null);
    assert.equal(engine.acceptClientPose({ pose: 'frente', confidence: 5 }, 0.8), null);
    assert.equal(engine.acceptClientPose({ pose: 'frente' }, 0.8), null);
  });

  test('inválido/desconhecido do cliente seguem para a fila do servidor', () => {
    assert.equal(engine.acceptClientPose({ pose: 'invalido', confidence: 0.99 }, 0.8), null);
    assert.equal(engine.acceptClientPose({ pose: 'desconhecido', confidence: 0.99 }, 0.8), null);
    assert.equal(engine.acceptClientPose({ pose: "frente'; drop", confidence: 0.99 }, 0.8), null);
    assert.equal(engine.acceptClientPose(null), null);
  });
});
