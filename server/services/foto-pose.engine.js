/**
 * Motor puro de poses de fotos de evolução — sem I/O.
 * Hierarquia: coach > vision > unknown (pose_aluno nunca entra no comparativo).
 */

const COMPARABLE_POSES = ['frente', 'costas', 'lado_esquerdo', 'lado_direito'];
const ALL_POSES = [...COMPARABLE_POSES, 'desconhecido', 'invalido'];
const ANALYSIS_STATUSES = ['pending', 'processing', 'classified', 'failed'];
const POSE_SOURCES = ['coach', 'vision', 'client_mediapipe', 'server_mediapipe', 'student', 'unknown'];
const AUTOMATIC_POSE_SOURCES = ['vision', 'client_mediapipe', 'server_mediapipe'];

function envNum(key, fallback) {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
}

function getThresholds() {
  return {
    high: envNum('POSE_CONFIDENCE_HIGH', 0.85),
    low: envNum('POSE_CONFIDENCE_LOW', 0.6),
  };
}

function normalizePose(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, '_')
    .replace(/\s+/g, '_');
  const map = {
    frente: 'frente',
    front: 'frente',
    costas: 'costas',
    back: 'costas',
    tras: 'costas',
    trás: 'costas',
    lado_esquerdo: 'lado_esquerdo',
    left: 'lado_esquerdo',
    left_side: 'lado_esquerdo',
    lado_direito: 'lado_direito',
    right: 'lado_direito',
    right_side: 'lado_direito',
    desconhecido: 'desconhecido',
    unknown: 'desconhecido',
    incerto: 'desconhecido',
    unclear: 'desconhecido',
    invalido: 'invalido',
    invalid: 'invalido',
  };
  return map[key] || 'desconhecido';
}

function isComparablePose(pose) {
  return COMPARABLE_POSES.includes(normalizePose(pose));
}

/**
 * Resolve pose efetiva para comparativo (hierarquia documentada).
 * @param {object} row
 */
function resolveEffectivePose(row = {}, thresholds = getThresholds()) {
  if (
    row.pose_efetiva &&
    row.pose_analysis_status !== 'pending' &&
    row.pose_analysis_status !== 'processing'
  ) {
    const pose = normalizePose(row.pose_efetiva);
    const source = row.pose_source || 'unknown';
    const confidence = Number(row.pose_vision_confidence);
    const hasConfidence = Number.isFinite(confidence);
    return {
      pose,
      source,
      confidence: hasConfidence ? confidence : source === 'coach' ? 1 : null,
      needs_review: AUTOMATIC_POSE_SOURCES.includes(source) && hasConfidence && confidence < thresholds.high,
      comparable: isComparablePose(pose),
    };
  }

  const coach = row.pose_coach ? normalizePose(row.pose_coach) : null;
  if (coach && ALL_POSES.includes(coach)) {
    return {
      pose: coach,
      source: 'coach',
      confidence: 1,
      needs_review: false,
      comparable: isComparablePose(coach),
    };
  }

  const visionRaw = row.pose_vision ? normalizePose(row.pose_vision) : null;
  const confidence = Number(row.pose_vision_confidence);
  const hasConfidence = Number.isFinite(confidence);

  if (visionRaw === 'invalido') {
    return {
      pose: 'invalido',
      source: 'vision',
      confidence: hasConfidence ? confidence : null,
      needs_review: false,
      comparable: false,
    };
  }

  if (visionRaw && isComparablePose(visionRaw)) {
    if (hasConfidence && confidence >= thresholds.high) {
      return {
        pose: visionRaw,
        source: 'vision',
        confidence,
        needs_review: false,
        comparable: true,
      };
    }
    if (hasConfidence && confidence >= thresholds.low) {
      return {
        pose: visionRaw,
        source: 'vision',
        confidence,
        needs_review: true,
        comparable: true,
      };
    }
  }

  if (visionRaw === 'desconhecido' || visionRaw) {
    return {
      pose: 'desconhecido',
      source: 'vision',
      confidence: hasConfidence ? confidence : null,
      needs_review: true,
      comparable: false,
    };
  }

  // Legado: descricao antiga — não confiar em tags de aluno (pose_source=student)
  const legacy = row.descricao ? normalizePose(row.descricao) : null;
  if (
    legacy &&
    isComparablePose(legacy) &&
    row.pose_analysis_status !== 'pending' &&
    row.pose_source !== 'student'
  ) {
    return {
      pose: legacy,
      source: 'student',
      confidence: null,
      needs_review: true,
      comparable: true,
    };
  }

  return {
    pose: 'desconhecido',
    source: 'unknown',
    confidence: null,
    needs_review: true,
    comparable: false,
  };
}

/**
 * Aplica resultado da visão + resolve efetiva.
 */
function buildPoseRecordFromVision(visionResult, row = {}, thresholds = getThresholds()) {
  const visionPose = normalizePose(visionResult?.pose);
  const peopleCount = Number(visionResult?.people_count);
  const suitable = visionResult?.suitable_for_compare !== false;
  let poseVision = visionPose;

  if (Number.isFinite(peopleCount) && peopleCount > 1) {
    poseVision = 'invalido';
  } else if (visionPose === 'invalido') {
    poseVision = 'invalido';
  } else if (!suitable && visionPose !== 'desconhecido') {
    poseVision = 'invalido';
  }

  const merged = {
    ...row,
    pose_efetiva: undefined,
    pose_vision: poseVision,
    pose_vision_confidence: Math.max(0, Math.min(1, Number(visionResult?.confidence) || 0)),
    pose_vision_reason: visionResult?.reason ? String(visionResult.reason).slice(0, 500) : null,
    pose_quality: {
      people_count: Number.isFinite(peopleCount) ? peopleCount : null,
      body_visible: visionResult?.body_visible ?? null,
      suitable_for_compare: suitable,
    },
  };

  const effective = resolveEffectivePose(merged, thresholds);
  return {
    pose_vision: poseVision,
    pose_vision_confidence: merged.pose_vision_confidence,
    pose_vision_reason: merged.pose_vision_reason,
    pose_quality: merged.pose_quality,
    pose_efetiva: effective.pose,
    pose_source: effective.source,
    descricao: effective.comparable ? effective.pose : effective.pose,
    pose_analysis_status: 'classified',
  };
}

/**
 * Pose calculada no dispositivo (MediaPipe). Dado enviado pelo cliente: só aceita poses
 * comparáveis acima do limiar; o resto segue para a fila de visão no servidor.
 * @returns {null | { pose: string, confidence: number }}
 */
function acceptClientPose(poseClient, minConfidence = envNum('POSE_CLIENT_MIN_CONFIDENCE', 0.8)) {
  if (!poseClient || typeof poseClient !== 'object') return null;
  const raw = String(poseClient.pose || '').trim().toLowerCase();
  if (!COMPARABLE_POSES.includes(raw)) return null;
  const confidence = Number(poseClient.confidence);
  if (!Number.isFinite(confidence) || confidence < minConfidence || confidence > 1) return null;
  return { pose: raw, confidence };
}

/**
 * Desempate quando há várias fotos da mesma pose num check-in.
 */
function pickBestPhotoForPose(photos, targetPose, resolveRow = resolveEffectivePose) {
  const pose = normalizePose(targetPose);
  if (!isComparablePose(pose) || !Array.isArray(photos) || photos.length === 0) return null;

  const candidates = photos
    .map((p) => {
      const eff = resolveRow(p);
      return { photo: p, eff };
    })
    .filter((c) => c.eff.comparable && normalizePose(c.eff.pose) === pose);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].photo;

  candidates.sort((a, b) => {
    const score = (c) => {
      let s = 0;
      if (c.eff.source === 'coach') s += 1000;
      const suitable = c.photo.pose_quality?.suitable_for_compare;
      if (suitable === true) s += 100;
      if (c.eff.confidence != null) s += c.eff.confidence * 50;
      const ts = new Date(c.photo.created_at || 0).getTime();
      return s + ts / 1e15;
    };
    return score(b) - score(a);
  });

  return candidates[0].photo;
}

function mapVisionToDbPose(visionPose) {
  return normalizePose(visionPose);
}

module.exports = {
  COMPARABLE_POSES,
  ALL_POSES,
  ANALYSIS_STATUSES,
  POSE_SOURCES,
  getThresholds,
  normalizePose,
  isComparablePose,
  resolveEffectivePose,
  buildPoseRecordFromVision,
  acceptClientPose,
  pickBestPhotoForPose,
  mapVisionToDbPose,
};
