/** Regras do check-in semanal (peso + fotos). */

export const MIN_CHECKIN_PHOTOS = 2;

export const CHECKIN_PHOTO_POSES = [
  "frente",
  "costas",
  "lado_esquerdo",
  "lado_direito",
] as const;

export type CheckinPhotoPose = (typeof CHECKIN_PHOTO_POSES)[number];

/** Slots canónicos do guia visual (ordem de captura sugerida). */
export const CHECKIN_PHOTO_SLOTS: ReadonlyArray<{
  pose: CheckinPhotoPose;
  index: number;
  label: string;
  hint: string;
  required: boolean;
}> = [
  {
    pose: "frente",
    index: 0,
    label: "Frente",
    hint: "De frente para a câmara",
    required: true,
  },
  {
    pose: "costas",
    index: 1,
    label: "Costas",
    hint: "De costas para a câmara",
    required: true,
  },
  {
    pose: "lado_esquerdo",
    index: 2,
    label: "Lado esquerdo",
    hint: "Perfil esquerdo",
    required: false,
  },
  {
    pose: "lado_direito",
    index: 3,
    label: "Lado direito",
    hint: "Perfil direito",
    required: false,
  },
];

export function getCheckinPoseLabel(pose: CheckinPhotoPose | string | undefined): string {
  const slot = CHECKIN_PHOTO_SLOTS.find((s) => s.pose === pose);
  return slot?.label || String(pose || "");
}

export function getCheckinPoseHint(pose: CheckinPhotoPose | string | undefined): string {
  const slot = CHECKIN_PHOTO_SLOTS.find((s) => s.pose === pose);
  return slot?.hint || "";
}

export function parsePesoKgInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 30 || n > 350) return null;
  return Math.round(n * 100) / 100;
}

export function formatPesoKgDisplay(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`;
}

export type CheckinPhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
  /** Orientação sugerida pelo slot do guia — NÃO é fonte de verdade do comparativo. */
  descricao?: CheckinPhotoPose;
};

/**
 * Preenche slots vazios em ordem canónica (frente → costas → laterais).
 * Fotos já existentes nos slots são preservadas.
 */
export function fillCheckinPhotoSlots(
  current: CheckinPhotoDraft[],
  incoming: CheckinPhotoDraft[],
): CheckinPhotoDraft[] {
  const byPose = new Map<CheckinPhotoPose, CheckinPhotoDraft>();
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

  return CHECKIN_PHOTO_SLOTS.map((slot) => byPose.get(slot.pose)).filter(
    (d): d is CheckinPhotoDraft => Boolean(d),
  );
}

/** Contagem de fotos preenchidas (slots com ficheiro). */
export function countFilledCheckinSlots(photos: CheckinPhotoDraft[]): number {
  return photos.filter((p) => Boolean(p.file)).length;
}
