import type { CheckinFormData } from "@/lib/checkin-types";
import { CHECKIN_FIELD_LABELS } from "@/lib/checkin-types";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

export type CheckinFieldDelta = "up" | "down" | "same" | "unknown";

const SCALE_KEYS = new Set<keyof CheckinFormData>(["seguiu_plano_nota", "autoestima"]);

const BOOLEAN_LIKE_KEYS = new Set<string>([
  "treinou_todas_sessoes",
  "desafiou_treinos",
  "fez_cardio",
  "seguiu_suplementacao",
  "ingeriu_agua_minima",
  "exposicao_sol",
  "dificuldade_adormecer",
  "estresse_semana",
  "higiene_sono",
]);

function isTruthy(value: unknown): boolean | null {
  if (value === true || value === "sim") return true;
  if (value === false || value === "nao") return false;
  return null;
}

export function formatCheckinFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }

  if (BOOLEAN_LIKE_KEYS.has(key)) {
    const parsed = isTruthy(value);
    if (parsed === true) return "Sim";
    if (parsed === false) return "Não";
    return String(value);
  }

  if (SCALE_KEYS.has(key as keyof CheckinFormData)) {
    return `${value}/5`;
  }

  if (key === "beliscou_fora_plano") {
    if (value === "prejudicando") return "Prejudicando";
    if (value === "comprometido") return "Comprometido";
  }

  if (key === "apetite" && typeof value === "string") {
    const map: Record<string, string> = { alto: "Alto", normal: "Normal", ruim: "Ruim" };
    return map[value] ?? value;
  }

  if (
    (key === "convivio_familiar" || key === "convivio_trabalho") &&
    typeof value === "string"
  ) {
    const map: Record<string, string> = { ruim: "Ruim", bom: "Bom", otimo: "Ótimo" };
    return map[value] ?? value;
  }

  if (key === "media_horas_sono" && typeof value === "string") {
    return `${value} h`;
  }

  if (key === "peso_kg") {
    const n = Number(value);
    if (Number.isFinite(n)) return `${n} kg`;
  }

  return String(value);
}

function numericValue(key: string, value: unknown): number | null {
  if (SCALE_KEYS.has(key as keyof CheckinFormData)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (BOOLEAN_LIKE_KEYS.has(key)) {
    const parsed = isTruthy(value);
    if (parsed === null) return null;
    return parsed ? 1 : 0;
  }
  return null;
}

/** Delta vs semana anterior (up = melhor, down = pior). */
export function compareCheckinField(
  key: string,
  current: unknown,
  previous: unknown,
): CheckinFieldDelta {
  const cur = numericValue(key, current);
  const prev = numericValue(key, previous);
  if (cur === null || prev === null) return "unknown";
  if (cur > prev) return "up";
  if (cur < prev) return "down";
  return "same";
}

export function deltaLabel(delta: CheckinFieldDelta): string | null {
  switch (delta) {
    case "up":
      return "↑ vs sem. anterior";
    case "down":
      return "↓ vs sem. anterior";
    case "same":
      return "= sem. anterior";
    default:
      return null;
  }
}

export function getCheckinSummaryChips(checkin: WeeklyCheckinRecord): string[] {
  const chips: string[] = [];
  if (checkin.peso_kg != null && Number.isFinite(Number(checkin.peso_kg))) {
    chips.push(`${checkin.peso_kg} kg`);
  }
  const adesao = checkin.seguiu_plano_nota;
  if (adesao != null) chips.push(`Adesão ${adesao}/5`);

  if (isTruthy(checkin.estresse_semana) === true) chips.push("Estresse");
  if (isTruthy(checkin.treinou_todas_sessoes) === false) chips.push("Treino incompleto");
  if (checkin.nao_cumpriu_porque?.trim()) chips.push("Com relato");

  if (adesao != null && adesao <= 2) chips.push("Adesão baixa");
  if (checkin.autoestima != null && checkin.autoestima <= 2) chips.push("Autoestima baixa");

  return chips;
}

export function getFieldLabel(key: string): string {
  if (key === "peso_kg") return "Peso (kg)";
  return CHECKIN_FIELD_LABELS[key] ?? key;
}

export function hasRelato(checkin: WeeklyCheckinRecord): boolean {
  return Boolean(checkin.nao_cumpriu_porque?.trim());
}

/** Texto publicado no portal do aluno (campo coach_resposta). */
export function hasCoachRespostaPublicada(checkin: WeeklyCheckinRecord): boolean {
  return Boolean(checkin.coach_resposta?.trim());
}

/** Marcação antiga (só coach_respondido_em) sem texto — aluno não vê no portal. */
export function isCheckinMarcadoSemTexto(checkin: WeeklyCheckinRecord): boolean {
  return Boolean(checkin.coach_respondido_em) && !hasCoachRespostaPublicada(checkin);
}

/** Respondido de verdade = texto salvo via «Salvar resposta». */
export function isCheckinRespondido(checkin: WeeklyCheckinRecord): boolean {
  return hasCoachRespostaPublicada(checkin);
}
