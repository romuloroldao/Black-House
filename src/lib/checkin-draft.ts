import { INITIAL_CHECKIN_FORM, type CheckinFormData } from "@/lib/checkin-types";
import { weekKeyFromDate } from "@/lib/checkin-streak";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/safe-storage";

/**
 * Rascunho local do check-in semanal (respostas + peso).
 * Fotos não entram: File/Blob não sobrevive a reload sem IndexedDB.
 * Escopo por utilizador + semana: rascunho de semana passada nunca é reaproveitado.
 */
export type CheckinDraft = {
  formData: CheckinFormData;
  pesoKg: string;
  savedAt: string;
};

const PREFIX = "bh-checkin-draft";

export function checkinDraftKey(userId: string, now: Date = new Date()): string {
  return `${PREFIX}:${userId}:${weekKeyFromDate(now)}`;
}

export function isCheckinDraftEmpty(formData: CheckinFormData, pesoKg: string): boolean {
  if (pesoKg.trim()) return false;
  return (Object.keys(INITIAL_CHECKIN_FORM) as Array<keyof CheckinFormData>).every(
    (k) => formData[k] === INITIAL_CHECKIN_FORM[k],
  );
}

export function parseCheckinDraft(raw: string | null): CheckinDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckinDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.formData) return null;
    const formData = { ...INITIAL_CHECKIN_FORM };
    for (const key of Object.keys(INITIAL_CHECKIN_FORM) as Array<keyof CheckinFormData>) {
      const value = (parsed.formData as Record<string, unknown>)[key];
      if (typeof value === typeof INITIAL_CHECKIN_FORM[key]) {
        (formData as Record<string, unknown>)[key] = value;
      }
    }
    return {
      formData,
      pesoKg: typeof parsed.pesoKg === "string" ? parsed.pesoKg : "",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function loadCheckinDraft(userId: string, now: Date = new Date()): CheckinDraft | null {
  return parseCheckinDraft(safeGetItem(checkinDraftKey(userId, now)));
}

/** Há rascunho com conteúdo nesta semana (para CTA no Hoje). */
export function hasCheckinDraft(userId: string | undefined | null, now: Date = new Date()): boolean {
  if (!userId) return false;
  const draft = loadCheckinDraft(userId, now);
  if (!draft) return false;
  return !isCheckinDraftEmpty(draft.formData, draft.pesoKg);
}

export function saveCheckinDraft(
  userId: string,
  formData: CheckinFormData,
  pesoKg: string,
  now: Date = new Date(),
): void {
  const key = checkinDraftKey(userId, now);
  if (isCheckinDraftEmpty(formData, pesoKg)) {
    safeRemoveItem(key);
    return;
  }
  const draft: CheckinDraft = { formData, pesoKg, savedAt: now.toISOString() };
  safeSetItem(key, JSON.stringify(draft));
}

export function clearCheckinDraft(userId: string, now: Date = new Date()): void {
  safeRemoveItem(checkinDraftKey(userId, now));
}
