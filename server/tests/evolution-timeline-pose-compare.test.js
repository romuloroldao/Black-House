/**
 * Testes unitários — pickBestPhotoForPose / pose_efetiva (espelho frontend).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../services/foto-pose.engine');

describe('comparador por pose_efetiva', () => {
  test('usa pose_efetiva sem fallback por ordem', () => {
    const photos = [
      { id: '1', descricao: null, created_at: '2026-01-01', pose_efetiva: 'costas', pose_source: 'vision' },
      { id: '2', descricao: null, created_at: '2026-01-02', pose_efetiva: 'frente', pose_source: 'vision' },
    ];
    assert.equal(engine.pickBestPhotoForPose(photos, 'frente')?.id, '2');
    assert.equal(engine.pickBestPhotoForPose(photos, 'costas')?.id, '1');
  });

  test('desconhecido não entra no comparativo', () => {
    const photos = [{ id: '1', pose_efetiva: 'desconhecido', pose_source: 'vision' }];
    assert.equal(engine.pickBestPhotoForPose(photos, 'frente'), null);
  });

  test('resolve via pose_vision quando pose_efetiva ainda pending', () => {
    const photos = [
      {
        id: '1',
        pose_analysis_status: 'pending',
        pose_vision: 'frente',
        pose_vision_confidence: 0.92,
        created_at: '2026-01-01',
      },
    ];
    assert.equal(engine.pickBestPhotoForPose(photos, 'frente')?.id, '1');
  });
});
