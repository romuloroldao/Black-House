/**
 * Lógica de pose efetiva no frontend (espelha server/services/foto-pose.engine.js).
 * vision_only: pose_aluno/descricao do aluno não entram no comparativo.
 */
import type { EvolutionPhoto } from './evolution-timeline';

const COMPARABLE_DB = ['frente', 'costas', 'lado_esquerdo', 'lado_direito'] as const;

const POSE_CONFIDENCE_HIGH = Number(import.meta.env.VITE_POSE_CONFIDENCE_HIGH) || 0.85;
const POSE_CONFIDENCE_LOW = Number(import.meta.env.VITE_POSE_CONFIDENCE_LOW) || 0.6;

export type EffectivePoseResult = {
  pose: string;
  source: string;
  confidence: number | null;
  needs_review: boolean;
  comparable: boolean;
};

function normalizeDbPose(raw?: string | null): string {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, '_')
    .replace(/\s+/g, '_');
  const map: Record<string, string> = {
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

export function isComparableDbPose(pose?: string | null): boolean {
  return COMPARABLE_DB.includes(normalizeDbPose(pose) as (typeof COMPARABLE_DB)[number]);
}

export function isPoseAnalysisPending(photo: EvolutionPhoto): boolean {
  return (
    photo.pose_analysis_status === 'pending' || photo.pose_analysis_status === 'processing'
  );
}

export function getEffectivePose(photo: EvolutionPhoto): EffectivePoseResult {
  if (
    photo.pose_efetiva &&
    photo.pose_analysis_status !== 'pending' &&
    photo.pose_analysis_status !== 'processing'
  ) {
    const pose = normalizeDbPose(photo.pose_efetiva);
    const source = photo.pose_source || 'unknown';
    const confidence = photo.pose_vision_confidence ?? null;
    const hasConfidence = confidence != null && Number.isFinite(confidence);
    return {
      pose,
      source,
      confidence: hasConfidence ? confidence : source === 'coach' ? 1 : null,
      needs_review: source === 'vision' && hasConfidence && confidence < POSE_CONFIDENCE_HIGH,
      comparable: isComparableDbPose(pose),
    };
  }

  const coach = photo.pose_coach ? normalizeDbPose(photo.pose_coach) : null;
  if (coach) {
    return {
      pose: coach,
      source: 'coach',
      confidence: 1,
      needs_review: false,
      comparable: isComparableDbPose(coach),
    };
  }

  const visionRaw = photo.pose_vision ? normalizeDbPose(photo.pose_vision) : null;
  const confidence = photo.pose_vision_confidence ?? null;
  const hasConfidence = confidence != null && Number.isFinite(confidence);

  if (visionRaw === 'invalido') {
    return {
      pose: 'invalido',
      source: 'vision',
      confidence: hasConfidence ? confidence : null,
      needs_review: false,
      comparable: false,
    };
  }

  if (visionRaw && isComparableDbPose(visionRaw)) {
    if (hasConfidence && confidence >= POSE_CONFIDENCE_HIGH) {
      return {
        pose: visionRaw,
        source: 'vision',
        confidence,
        needs_review: false,
        comparable: true,
      };
    }
    if (hasConfidence && confidence >= POSE_CONFIDENCE_LOW) {
      return {
        pose: visionRaw,
        source: 'vision',
        confidence,
        needs_review: true,
        comparable: true,
      };
    }
  }

  if (visionRaw) {
    return {
      pose: 'desconhecido',
      source: 'vision',
      confidence: hasConfidence ? confidence : null,
      needs_review: true,
      comparable: false,
    };
  }

  // Plano B: tag legada em descricao (provisório até visão classificar)
  const legacy = photo.descricao ? normalizeDbPose(photo.descricao) : null;
  if (legacy && isComparableDbPose(legacy)) {
    return {
      pose: legacy,
      source: 'legacy_descricao',
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

const POSE_UI_TO_DB: Record<string, string> = {
  front: 'frente',
  back: 'costas',
  leftSide: 'lado_esquerdo',
  rightSide: 'lado_direito',
};

export function uiPoseToDb(pose: string): string {
  return POSE_UI_TO_DB[pose] || normalizeDbPose(pose);
}

export function pickBestPhotoForPose(
  photos: EvolutionPhoto[],
  targetPose: string,
): EvolutionPhoto | null {
  const targetDb = uiPoseToDb(targetPose);
  if (!isComparableDbPose(targetDb) || !photos.length) return null;

  const candidates = photos
    .map((photo) => ({ photo, eff: getEffectivePose(photo) }))
    .filter((c) => c.eff.comparable && normalizeDbPose(c.eff.pose) === targetDb);

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].photo;

  candidates.sort((a, b) => {
    const score = (c: (typeof candidates)[0]) => {
      let s = 0;
      if (c.eff.source === 'coach') s += 1000;
      const suitable = c.photo.pose_quality?.suitable_for_compare;
      if (suitable === true) s += 100;
      if (c.eff.confidence != null) s += c.eff.confidence * 50;
      return s + new Date(c.photo.created_at || 0).getTime() / 1e15;
    };
    return score(b) - score(a);
  });

  return candidates[0].photo;
}
