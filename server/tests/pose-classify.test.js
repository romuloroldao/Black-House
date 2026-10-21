/**
 * Testa src/lib/pose-classify.ts (o próprio ficheiro TS, transpilado com esbuild).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadTsModule } = require('../scripts/lib/load-ts');

const { classifyPoseFromLandmarks } = loadTsModule(
  path.resolve(__dirname, '..', '..', 'src', 'lib', 'pose-classify.ts'),
);

const SIZE = { width: 1000, height: 1000 };

function body(points) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  for (const [i, p] of Object.entries(points)) lm[Number(i)] = { z: 0, visibility: 0.99, ...p };
  return lm;
}

// De frente: ombro esquerdo (11) à direita da imagem, nariz à frente dos ombros (z negativo).
const front = body({
  0: { x: 0.5, y: 0.2, z: -0.4 },
  2: { x: 0.52, y: 0.18 },
  5: { x: 0.48, y: 0.18 },
  11: { x: 0.62, y: 0.3 },
  12: { x: 0.38, y: 0.3 },
  23: { x: 0.58, y: 0.62 },
  24: { x: 0.42, y: 0.62 },
});

const back = body({
  0: { x: 0.5, y: 0.2, z: 0.4, visibility: 0.3 },
  2: { x: 0.48, y: 0.18, visibility: 0.3 },
  5: { x: 0.52, y: 0.18, visibility: 0.3 },
  7: { x: 0.53, y: 0.19 },
  8: { x: 0.47, y: 0.19 },
  11: { x: 0.38, y: 0.3 },
  12: { x: 0.62, y: 0.3 },
  23: { x: 0.42, y: 0.62 },
  24: { x: 0.58, y: 0.62 },
});

// Perfil com o rosto para a esquerda da imagem = lado esquerdo do corpo virado para a câmara.
function profile(faceDir) {
  const s = faceDir === 'left' ? -1 : 1;
  const near = faceDir === 'left' ? 11 : 12;
  const far = faceDir === 'left' ? 12 : 11;
  const nearHip = faceDir === 'left' ? 23 : 24;
  const farHip = faceDir === 'left' ? 24 : 23;
  return body({
    0: { x: 0.5 + s * 0.06, y: 0.2 },
    [near]: { x: 0.51, y: 0.3, z: -0.1 },
    [far]: { x: 0.49, y: 0.3, z: 0.1, visibility: 0.6 },
    [nearHip]: { x: 0.505, y: 0.62, z: -0.1 },
    [farHip]: { x: 0.495, y: 0.62, z: 0.1, visibility: 0.6 },
  });
}

test('frente', () => {
  assert.equal(classifyPoseFromLandmarks([front], SIZE).pose, 'frente');
});

test('costas', () => {
  assert.equal(classifyPoseFromLandmarks([back], SIZE).pose, 'costas');
});

test('rosto para a esquerda da imagem = lado_esquerdo (convenção anatómica)', () => {
  const r = classifyPoseFromLandmarks([profile('left')], SIZE);
  assert.equal(r.pose, 'lado_esquerdo');
  assert.ok(r.confidence >= 0.7);
});

test('rosto para a direita da imagem = lado_direito', () => {
  assert.equal(classifyPoseFromLandmarks([profile('right')], SIZE).pose, 'lado_direito');
});

test('sem pessoa ou mais de uma pessoa = invalido', () => {
  assert.equal(classifyPoseFromLandmarks([], SIZE).pose, 'invalido');
  const two = classifyPoseFromLandmarks([front, back], SIZE);
  assert.equal(two.pose, 'invalido');
  assert.equal(two.people_count, 2);
});

test('quadril fora da imagem = invalido', () => {
  const cut = body({ ...Object.fromEntries([0, 11, 12].map((i) => [i, front[i]])), 23: { x: 0.58, y: 1.2 }, 24: { x: 0.42, y: 1.2 } });
  assert.equal(classifyPoseFromLandmarks([cut], SIZE).pose, 'invalido');
});

test('ângulo intermédio = desconhecido', () => {
  const mid = body({
    0: { x: 0.5, y: 0.2 },
    11: { x: 0.56, y: 0.3 },
    12: { x: 0.44, y: 0.3 },
    23: { x: 0.53, y: 0.62 },
    24: { x: 0.47, y: 0.62 },
  });
  assert.equal(classifyPoseFromLandmarks([mid], SIZE).pose, 'desconhecido');
});

test('usa as dimensões reais da imagem (retrato 3:4)', () => {
  const r = classifyPoseFromLandmarks([front], { width: 750, height: 1000 });
  assert.equal(r.pose, 'frente');
});
