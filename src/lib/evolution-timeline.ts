import { tEvolution } from '@/i18n/evolution-photos';

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

export function normalizePhotoPose(description?: string | null): EvolutionPhotoPose {
  const key = String(description || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return poseMap[key] || 'extra';
}

export function poseLabel(description: string | null | undefined, index: number): string {
  const pose = normalizePhotoPose(description);
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
    const poseA = poseOrder.indexOf(normalizePhotoPose(a.descricao));
    const poseB = poseOrder.indexOf(normalizePhotoPose(b.descricao));
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
