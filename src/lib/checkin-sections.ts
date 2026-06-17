import type { CheckinFormData } from "@/lib/checkin-types";

export type CheckinSectionId = "corpo" | "nutricao" | "treino" | "sono" | "bem_estar";

export function getCheckinSectionTitleId(sectionId: CheckinSectionId): string {
  return `checkin-section-${sectionId}-title`;
}

export function getCheckinSectionDescId(sectionId: CheckinSectionId): string {
  return `checkin-section-${sectionId}-desc`;
}

export const CHECKIN_SECTIONS: Array<{
  id: CheckinSectionId;
  title: string;
  description: string;
}> = [
  { id: "corpo", title: "Peso e fotos", description: "Peso atual e fotos de evolução desta semana" },
  { id: "nutricao", title: "Nutrição", description: "Dieta, suplementos e hidratação" },
  { id: "treino", title: "Treino", description: "Sessões, cardio e desafios" },
  { id: "sono", title: "Sono", description: "Descanso e higiene do sono" },
  { id: "bem_estar", title: "Bem-estar", description: "Mental, digestão e observações" },
];

export const CHECKIN_SECTION_FIELD_KEYS: Record<CheckinSectionId, (keyof CheckinFormData)[]> = {
  corpo: [],
  nutricao: [
    "beliscou_fora_plano",
    "seguiu_plano_nota",
    "apetite",
    "seguiu_suplementacao",
    "recursos_hormonais",
    "ingeriu_agua_minima",
    "exposicao_sol",
    "pressao_arterial",
    "glicemia",
  ],
  treino: ["treinou_todas_sessoes", "desafiou_treinos", "fez_cardio"],
  sono: ["media_horas_sono", "dificuldade_adormecer", "acordou_noite", "higiene_sono"],
  bem_estar: [
    "estresse_semana",
    "lida_desafios",
    "convivio_familiar",
    "convivio_trabalho",
    "postura_problemas",
    "autoestima",
    "media_evacuacoes",
    "formato_fezes",
    "nao_cumpriu_porque",
  ],
};

const OPTIONAL_IN_SECTION = new Set<keyof CheckinFormData>([
  "pressao_arterial",
  "glicemia",
  "acordou_noite",
  "nao_cumpriu_porque",
]);

export function isSectionFieldComplete(
  data: CheckinFormData,
  key: keyof CheckinFormData,
): boolean {
  if (OPTIONAL_IN_SECTION.has(key)) return true;
  const value = data[key];
  if (key === "seguiu_plano_nota" || key === "autoestima") {
    return typeof value === "number" && value >= 1 && value <= 5;
  }
  const simNaoFields: (keyof CheckinFormData)[] = [
    "treinou_todas_sessoes",
    "desafiou_treinos",
    "fez_cardio",
    "seguiu_suplementacao",
    "ingeriu_agua_minima",
    "exposicao_sol",
    "dificuldade_adormecer",
    "estresse_semana",
    "higiene_sono",
  ];
  if (simNaoFields.includes(key)) {
    return value === "sim" || value === "nao";
  }
  return value !== "" && value !== null && value !== undefined;
}

export type CheckinCorpoExtras = {
  pesoKg: string;
  photoCount: number;
  minPhotos?: number;
};

export function isCorpoSectionComplete(
  extras: CheckinCorpoExtras,
): boolean {
  const trimmed = extras.pesoKg.trim().replace(",", ".");
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return false;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 30 || n > 350) return false;
  const min = extras.minPhotos ?? 2;
  return extras.photoCount >= min;
}

export function getCorpoSectionMissingLabels(extras: CheckinCorpoExtras): string[] {
  const missing: string[] = [];
  const trimmed = extras.pesoKg.trim().replace(",", ".");
  if (!trimmed) missing.push("Peso (kg)");
  else if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) missing.push("Peso com formato inválido");
  else {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 30 || n > 350) missing.push("Peso fora da faixa (30–350 kg)");
  }
  const min = extras.minPhotos ?? 2;
  if (extras.photoCount < min) {
    missing.push(`Fotos (mínimo ${min})`);
  }
  return missing;
}

export function getSectionMissingLabels(
  data: CheckinFormData,
  sectionId: CheckinSectionId,
  fieldLabels: Record<string, string>,
  corpoExtras?: CheckinCorpoExtras,
): string[] {
  if (sectionId === "corpo") {
    return corpoExtras ? getCorpoSectionMissingLabels(corpoExtras) : ["Peso e fotos"];
  }
  const missing: string[] = [];
  for (const key of CHECKIN_SECTION_FIELD_KEYS[sectionId]) {
    if (OPTIONAL_IN_SECTION.has(key)) continue;
    if (!isSectionFieldComplete(data, key)) {
      missing.push(fieldLabels[key] || key);
    }
  }
  return missing;
}

export function countCompletedSections(
  data: CheckinFormData,
  fieldLabels: Record<string, string>,
  corpoExtras?: CheckinCorpoExtras,
): number {
  return CHECKIN_SECTIONS.filter(
    (s) => getSectionMissingLabels(data, s.id, fieldLabels, corpoExtras).length === 0,
  ).length;
}
