/** Regras do check-in semanal (peso + fotos). */

export const MIN_CHECKIN_PHOTOS = 2;

export const CHECKIN_PHOTO_POSES = [
  "frente",
  "costas",
  "lado_esquerdo",
  "lado_direito",
] as const;

export type CheckinPhotoPose = (typeof CHECKIN_PHOTO_POSES)[number];

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
  descricao?: CheckinPhotoPose;
};
