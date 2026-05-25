import type { CheckinFormData } from "@/lib/checkin-types";

const CHECKIN_OPTIONAL_KEYS: (keyof CheckinFormData)[] = [
  "pressao_arterial",
  "glicemia",
  "acordou_noite",
  "nao_cumpriu_porque",
];

function optionalCheckinText(value: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Payload alinhado a POST /api/checkins (server/routes/api.js). */
export function buildCheckinPayload(data: CheckinFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    beliscou_fora_plano: data.beliscou_fora_plano,
    seguiu_plano_nota: data.seguiu_plano_nota,
    apetite: data.apetite,
    treinou_todas_sessoes: data.treinou_todas_sessoes === "sim",
    desafiou_treinos: data.desafiou_treinos === "sim",
    fez_cardio: data.fez_cardio === "sim",
    seguiu_suplementacao: data.seguiu_suplementacao === "sim",
    recursos_hormonais: data.recursos_hormonais,
    ingeriu_agua_minima: data.ingeriu_agua_minima === "sim",
    exposicao_sol: data.exposicao_sol === "sim",
    media_horas_sono: data.media_horas_sono,
    dificuldade_adormecer: data.dificuldade_adormecer === "sim",
    estresse_semana: data.estresse_semana === "sim",
    lida_desafios: data.lida_desafios,
    convivio_familiar: data.convivio_familiar,
    convivio_trabalho: data.convivio_trabalho,
    postura_problemas: data.postura_problemas,
    higiene_sono: data.higiene_sono === "sim",
    autoestima: data.autoestima,
    media_evacuacoes: data.media_evacuacoes,
    formato_fezes: data.formato_fezes,
  };

  for (const key of CHECKIN_OPTIONAL_KEYS) {
    payload[key] = optionalCheckinText(data[key] as string);
  }

  return payload;
}
