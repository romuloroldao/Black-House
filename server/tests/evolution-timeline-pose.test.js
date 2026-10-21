/**
 * Testes unitários — matching de pose em fotos de evolução.
 * Espelha src/lib/evolution-timeline.ts (findPhotoByPose, isUntaggedPhoto).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const poseMap = {
  frente: 'front',
  front: 'front',
  costas: 'back',
  back: 'back',
  'lado esquerdo': 'leftSide',
  'lado direito': 'rightSide',
};

const poseIndexToCanonical = ['front', 'back', 'leftSide', 'rightSide'];

function normalizePhotoPose(description) {
  const key = String(description || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return poseMap[key] || 'extra';
}

function isUntaggedPhoto(photo) {
  return normalizePhotoPose(photo.descricao) === 'extra';
}

function sortPhotosChronologically(photos) {
  return [...photos].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
}

function findPhotoByPose(photos, pose) {
  if (!photos.length || pose === 'extra') return null;

  const explicit = photos.find((p) => normalizePhotoPose(p.descricao) === pose);
  if (explicit) return explicit;

  const poseIndex = poseIndexToCanonical.indexOf(pose);
  if (poseIndex < 0) return null;

  const chrono = sortPhotosChronologically(photos);
  const candidate = chrono[poseIndex];
  if (candidate && isUntaggedPhoto(candidate)) {
    return candidate;
  }
  return null;
}

describe('findPhotoByPose', () => {
  test('encontra tag explícita frente', () => {
    const photos = [
      { id: '1', descricao: 'costas', created_at: '2026-01-02T00:00:00Z' },
      { id: '2', descricao: 'frente', created_at: '2026-01-01T00:00:00Z' },
    ];
    const match = findPhotoByPose(photos, 'front');
    assert.equal(match?.id, '2');
  });

  test('fallback por ordem quando sem tag — 1ª=frente, 2ª=costas', () => {
    const photos = [
      { id: 'a', descricao: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', descricao: null, created_at: '2026-01-02T00:00:00Z' },
    ];
    assert.equal(findPhotoByPose(photos, 'front')?.id, 'a');
    assert.equal(findPhotoByPose(photos, 'back')?.id, 'b');
  });

  test('não usa fallback se foto do índice já tem outra tag', () => {
    const photos = [
      { id: 'a', descricao: 'lado_esquerdo', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', descricao: null, created_at: '2026-01-02T00:00:00Z' },
    ];
    assert.equal(findPhotoByPose(photos, 'front'), null);
    assert.equal(findPhotoByPose(photos, 'back')?.id, 'b');
  });

  test('normaliza Frente com maiúscula', () => {
    const photos = [{ id: 'x', descricao: 'Frente', created_at: '2026-01-01T00:00:00Z' }];
    assert.equal(findPhotoByPose(photos, 'front')?.id, 'x');
  });
});
