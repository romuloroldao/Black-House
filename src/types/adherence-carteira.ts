export type AdherenceRates = {
  meal_pct: number | null;
  workout_pct: number | null;
  meal_days: number;
  meal_expected: number;
  workout_done: number;
  workout_expected: number;
};

export type AdherenceCarteiraItem = {
  aluno_id: string;
  nome: string;
  checkin_pendente: boolean;
  checkin_id: string | null;
  attention_score: number;
  adherence_drop: boolean;
  streak_days: number;
  miss_days_recent: number;
  rates: AdherenceRates;
};

export type AdherenceCarteiraResponse = {
  days: number;
  as_of: string;
  items: AdherenceCarteiraItem[];
  attention_count: number;
  drop_count: number;
  pending_checkin_count: number;
  gerado_em: string;
};
