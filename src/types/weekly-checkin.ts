/** Registo de check-in semanal (API / weekly_checkins). */
export type WeeklyCheckinRecord = {
  id: string;
  aluno_id?: string;
  created_at: string;
  status?: string | null;
  beliscou_fora_plano?: string | null;
  seguiu_plano_nota?: number | null;
  apetite?: string | null;
  treinou_todas_sessoes?: boolean | string | null;
  desafiou_treinos?: boolean | string | null;
  fez_cardio?: boolean | string | null;
  seguiu_suplementacao?: boolean | string | null;
  recursos_hormonais?: string | null;
  ingeriu_agua_minima?: boolean | string | null;
  exposicao_sol?: boolean | string | null;
  pressao_arterial?: string | null;
  glicemia?: string | null;
  media_horas_sono?: string | null;
  dificuldade_adormecer?: boolean | string | null;
  acordou_noite?: string | null;
  estresse_semana?: boolean | string | null;
  lida_desafios?: string | null;
  convivio_familiar?: string | null;
  convivio_trabalho?: string | null;
  postura_problemas?: string | null;
  higiene_sono?: boolean | string | null;
  autoestima?: number | null;
  media_evacuacoes?: string | null;
  formato_fezes?: string | null;
  nao_cumpriu_porque?: string | null;
  coach_respondido_em?: string | null;
  coach_respondido_por?: string | null;
};

export type FeedbackAlunoRecord = {
  id: string;
  aluno_id: string;
  coach_id?: string;
  feedback?: string;
  updated_at?: string;
  created_at?: string;
};

export type { CheckinAiDraftResponse, CheckinAiTrendsResponse } from "@/types/checkin-ai";
