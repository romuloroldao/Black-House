import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CHECKIN_SECTION_FIELD_KEYS, CHECKIN_SECTIONS, type CheckinSectionId } from "@/lib/checkin-sections";
import {
  compareCheckinField,
  deltaLabel,
  formatCheckinFieldValue,
  getFieldLabel,
} from "@/lib/checkin-display";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

export function formatCheckinWeekLabel(checkin: WeeklyCheckinRecord): string {
  return format(new Date(checkin.created_at), "dd MMM yyyy · HH:mm", { locale: ptBR });
}

export const COMPARE_FIELD_KEYS = CHECKIN_SECTIONS.flatMap((s) =>
  CHECKIN_SECTION_FIELD_KEYS[s.id].filter((k) => k !== "nao_cumpriu_porque"),
);

export function getCompareSections(): typeof CHECKIN_SECTIONS {
  return CHECKIN_SECTIONS;
}

export type CompareFieldRow = {
  key: string;
  label: string;
  left: string;
  right: string;
  delta: ReturnType<typeof compareCheckinField>;
  deltaText: string | null;
};

export function buildCompareRows(
  left: WeeklyCheckinRecord,
  right: WeeklyCheckinRecord,
): CompareFieldRow[] {
  return COMPARE_FIELD_KEYS.map((key) => {
    const leftVal = left[key as keyof WeeklyCheckinRecord];
    const rightVal = right[key as keyof WeeklyCheckinRecord];
    const delta = compareCheckinField(key, leftVal, rightVal);
    return {
      key,
      label: getFieldLabel(key),
      left: formatCheckinFieldValue(key, leftVal),
      right: formatCheckinFieldValue(key, rightVal),
      delta,
      deltaText: deltaLabel(delta),
    };
  });
}
