import { tEvolution } from '@/i18n/evolution-photos';
import { getEffectivePose, pickBestPhotoForPose } from './evolution-timeline-pose';

export type EvolutionPhotoPose = 'front' | 'back' | 'leftSide' | 'rightSide' | 'extra';

export type EvolutionPhoto = {
  id: string;
  aluno_id?: string;
  url: string;
  descricao?: string | null;
  created_at: string;
  weekly_checkin_id?: string | null;
  checkin_created_at?: string | null;
  peso_kg?: number | string | null;
  pose_aluno?: string | null;
  pose_vision?: string | null;
  pose_vision_confidence?: number | null;
  pose_vision_reason?: string | null;
  pose_coach?: string | null;
  pose_source?: string | null;
  pose_efetiva?: string | null;
  pose_quality?: {
    people_count?: number | null;
    body_visible?: boolean | null;
    suitable_for_compare?: boolean | null;
  } | null;
  pose_analysis_status?: 'pending' | 'processing' | 'classified' | 'failed' | null;
  pose_analyzed_at?: string | null;
};

export type EvolutionTimelineItem = {
  id: string;
  label: string;
  date: string;
  photos: EvolutionPhoto[];
  pesoKg: number | null;
  deltaPreviousKg: number | null;
  deltaFirstKg: number | null;
  weekIndex: number;
  isCurrent: boolean;
};

const poseMap: Record<string, EvolutionPhotoPose> = {
  'frente': 'front',
  'front': 'front',
  'costas': 'back',
  'back': 'back',
  'tras': 'back',
  'trás': 'back',
  'lado esquerdo': 'leftSide',
  'left side': 'leftSide',
  'left': 'leftSide',
  'lado direito': 'rightSide',
  'right side': 'rightSide',
  'right': 'rightSide',
};

const poseOrder: EvolutionPhotoPose[] = ['front', 'back', 'leftSide', 'rightSide', 'extra'];

const LEGACY_ORDER_FALLBACK =
  import.meta.env.VITE_POSE_LEGACY_ORDER_FALLBACK === 'true';

/** Ordem canónica de poses por índice no check-in (legado). */
const poseIndexToCanonical: EvolutionPhotoPose[] = ['front', 'back', 'leftSide', 'rightSide'];

const DB_TO_UI: Record<string, EvolutionPhotoPose> = {
  frente: 'front',
  costas: 'back',
  lado_esquerdo: 'leftSide',
  lado_direito: 'rightSide',
};

export function isUntaggedPhoto(photo: EvolutionPhoto): boolean {
  const eff = getEffectivePose(photo);
  if (eff.comparable) return false;
  if (photo.pose_analysis_status === 'pending' || photo.pose_analysis_status === 'processing') {
    return true;
  }
  return normalizePhotoPose(photo.descricao) === 'extra';
}

export { getEffectivePose, pickBestPhotoForPose } from './evolution-timeline-pose';

/**
 * Encontra a melhor foto para a pose pedida (pose_efetiva; sem fallback por ordem por defeito).
 */
export function findPhotoByPose(
  photos: EvolutionPhoto[],
  pose: EvolutionPhotoPose,
): EvolutionPhoto | null {
  if (!photos.length || pose === 'extra') return null;

  const best = pickBestPhotoForPose(photos, pose);
  if (best) return best;

  if (!LEGACY_ORDER_FALLBACK) return null;

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

/** Poses comparáveis disponíveis num check-in. */
export function getAvailablePosesForPhotos(photos: EvolutionPhoto[]): EvolutionPhotoPose[] {
  const found = new Set<EvolutionPhotoPose>();
  for (const photo of photos) {
    const eff = getEffectivePose(photo);
    if (!eff.comparable) continue;
    const ui = DB_TO_UI[normalizeDbPoseForUi(eff.pose)];
    if (ui) found.add(ui);
  }
  if (found.size > 0) {
    return poseIndexToCanonical.filter((p) => found.has(p));
  }
  if (LEGACY_ORDER_FALLBACK) {
    const legacy: EvolutionPhotoPose[] = [];
    for (const pose of poseIndexToCanonical) {
      if (findPhotoByPose(photos, pose)) legacy.push(pose);
    }
    return legacy;
  }
  return [];
}

/** Poses comparáveis disponíveis em ambos os check-ins (interseção). */
export function getCommonPosesForPhotos(
  photosA: EvolutionPhoto[],
  photosB: EvolutionPhoto[],
): EvolutionPhotoPose[] {
  const a = new Set(getAvailablePosesForPhotos(photosA));
  const b = new Set(getAvailablePosesForPhotos(photosB));
  return poseIndexToCanonical.filter((p) => a.has(p) && b.has(p));
}

function normalizeDbPoseForUi(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, '_');
}

export function sortPhotosChronologically(photos: EvolutionPhoto[]): EvolutionPhoto[] {
  return [...photos].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
}

export function normalizePhotoPose(description?: string | null, photo?: EvolutionPhoto): EvolutionPhotoPose {
  if (photo) {
    const eff = getEffectivePose(photo);
    const db = normalizeDbPoseForUi(eff.pose);
    if (DB_TO_UI[db]) return DB_TO_UI[db];
    if (db === 'desconhecido' || db === 'invalido') return 'extra';
  }
  const key = String(description || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return poseMap[key] || 'extra';
}

export function poseLabel(description: string | null | undefined, index: number, photo?: EvolutionPhoto): string {
  const pose = normalizePhotoPose(description, photo);
  if (pose === 'front') return tEvolution('front');
  if (pose === 'back') return tEvolution('back');
  if (pose === 'leftSide') return tEvolution('leftSide');
  if (pose === 'rightSide') return tEvolution('rightSide');
  return `${tEvolution('photoNumber')} ${index + 1}`;
}

export function formatWeight(kg: number | null): string {
  if (kg == null) return tEvolution('noWeight');
  return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

export function formatWeightDelta(kg: number | null): string | null {
  if (kg == null || Math.abs(kg) < 0.05) return null;
  const sign = kg > 0 ? '+' : '';
  return `${sign}${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

/** Delta de peso entre o par Antes (baseline) e Depois (current). */
export function weightDeltaBetween(
  afterKg: number | null | undefined,
  beforeKg: number | null | undefined,
): number | null {
  if (afterKg == null || beforeKg == null) return null;
  if (!Number.isFinite(afterKg) || !Number.isFinite(beforeKg)) return null;
  return afterKg - beforeKg;
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatAgeLabel(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startDate) / 86400000);
  if (diffDays <= 0) return tEvolution('uploadedToday');
  if (diffDays === 1) return tEvolution('uploadedYesterday');
  if (diffDays < 30) return tEvolution('daysAgo', { days: diffDays });
  return formatDateShort(iso);
}

function parseWeight(value: EvolutionPhoto['peso_kg']): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getGroupDate(photo: EvolutionPhoto): string {
  return photo.checkin_created_at || photo.created_at;
}

function getGroupId(photo: EvolutionPhoto): string {
  if (photo.weekly_checkin_id) return `checkin:${photo.weekly_checkin_id}`;
  const date = new Date(photo.created_at);
  if (Number.isNaN(date.getTime())) return `photo:${photo.id}`;
  return `date:${date.toISOString().slice(0, 10)}`;
}

export function sortPhotosByPose(photos: EvolutionPhoto[]): EvolutionPhoto[] {
  return [...photos].sort((a, b) => {
    const poseA = poseOrder.indexOf(normalizePhotoPose(a.descricao, a));
    const poseB = poseOrder.indexOf(normalizePhotoPose(b.descricao, b));
    if (poseA !== poseB) return poseA - poseB;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

export function groupPhotosIntoCheckins(photos: EvolutionPhoto[]): EvolutionTimelineItem[] {
  const groups = new Map<string, EvolutionPhoto[]>();

  for (const photo of photos) {
    const id = getGroupId(photo);
    const group = groups.get(id) || [];
    group.push(photo);
    groups.set(id, group);
  }

  const chronological = Array.from(groups.entries())
    .map(([id, group]) => {
      const ordered = sortPhotosByPose(group);
      const date = ordered[0] ? getGroupDate(ordered[0]) : '';
      return {
        id,
        date,
        photos: ordered,
        pesoKg: parseWeight(ordered.find((p) => p.peso_kg != null)?.peso_kg),
      };
    })
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  const firstWeight = chronological.find((item) => item.pesoKg != null)?.pesoKg ?? null;

  return chronological
    .map((item, index, all) => {
      const previousWeight = [...all.slice(0, index)].reverse().find((candidate) => candidate.pesoKg != null)
        ?.pesoKg ?? null;
      return {
        ...item,
        label: `${tEvolution('week')} ${index + 1}`,
        weekIndex: index + 1,
        deltaPreviousKg:
          item.pesoKg != null && previousWeight != null ? Math.round((item.pesoKg - previousWeight) * 10) / 10 : null,
        deltaFirstKg:
          item.pesoKg != null && firstWeight != null ? Math.round((item.pesoKg - firstWeight) * 10) / 10 : null,
        isCurrent: index === all.length - 1,
      };
    })
    .reverse();
}

export function getWeeksTracked(items: EvolutionTimelineItem[]): number {
  if (items.length < 2) return items.length;
  const newest = new Date(items[0].date).getTime();
  const oldest = new Date(items[items.length - 1].date).getTime();
  if (!Number.isFinite(newest) || !Number.isFinite(oldest)) return items.length;
  return Math.max(1, Math.ceil(Math.abs(newest - oldest) / (7 * 86400000)) + 1);
}
