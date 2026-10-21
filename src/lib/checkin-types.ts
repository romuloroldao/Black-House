export type CheckinFormData = {
  beliscou_fora_plano: string;
  seguiu_plano_nota: number;
  apetite: string;
  treinou_todas_sessoes: string;
  desafiou_treinos: string;
  fez_cardio: string;
  seguiu_suplementacao: string;
  recursos_hormonais: string;
  ingeriu_agua_minima: string;
  exposicao_sol: string;
  pressao_arterial: string;
  glicemia: string;
  media_horas_sono: string;
  dificuldade_adormecer: string;
  acordou_noite: string;
  estresse_semana: string;
  lida_desafios: string;
  convivio_familiar: string;
  convivio_trabalho: string;
  postura_problemas: string;
  higiene_sono: string;
  autoestima: number;
  media_evacuacoes: string;
  formato_fezes: string;
  nao_cumpriu_porque: string;
};

export const INITIAL_CHECKIN_FORM: CheckinFormData = {
  beliscou_fora_plano: "",
  seguiu_plano_nota: 3,
  apetite: "",
  treinou_todas_sessoes: "",
  desafiou_treinos: "",
  fez_cardio: "",
  seguiu_suplementacao: "",
  recursos_hormonais: "",
  ingeriu_agua_minima: "",
  exposicao_sol: "",
  pressao_arterial: "",
  glicemia: "",
  media_horas_sono: "",
  dificuldade_adormecer: "",
  acordou_noite: "",
  estresse_semana: "",
  lida_desafios: "",
  convivio_familiar: "",
  convivio_trabalho: "",
  postura_problemas: "",
  higiene_sono: "",
  autoestima: 3,
  media_evacuacoes: "",
  formato_fezes: "",
  nao_cumpriu_porque: "",
};

export const CHECKIN_FIELD_LABELS: Record<string, string> = {
  beliscou_fora_plano: "Beliscou fora do plano?",
  seguiu_plano_nota: "Seguiu o plano alimentar",
  apetite: "Apetite",
  treinou_todas_sessoes: "Treinou todas as sessões?",
  desafiou_treinos: "Desafiou-se nos treinos?",
  fez_cardio: "Fez todo o cardio?",
  seguiu_suplementacao: "Seguiu suplementação?",
  recursos_hormonais: "Recursos hormonais",
  ingeriu_agua_minima: "Ingeriu água mínima?",
  exposicao_sol: "Exposição ao sol?",
  media_horas_sono: "Média de horas de sono",
  dificuldade_adormecer: "Dificuldade para adormecer?",
  estresse_semana: "Estresse da semana",
  lida_desafios: "Lida com desafios",
  convivio_familiar: "Convívio familiar",
  convivio_trabalho: "Convívio no trabalho",
  postura_problemas: "Postura frente a problemas",
  higiene_sono: "Higiene do sono",
  media_evacuacoes: "Média de evacuações",
  formato_fezes: "Formato das fezes (Bristol)",
};
