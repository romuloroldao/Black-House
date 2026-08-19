export type AdherenceCarteiraRates = {
  meal_pct: number | null;
  workout_pct: number | null;
  meal_days: number;
  meal_expected: number;
  workout_done: number;
  workout_expected: number;
};

export type AdherenceCarteiraSummary = {
  totals: { completed: number; missed: number; cancelled: number };
  completion_rate: number | null;
  available: boolean;
};

export type AdherenceCarteiraItem = {
  aluno_id: string;
  nome: string;
  email?: string | null;
  streak_days: number;
  miss_days: number;
  rates: AdherenceCarteiraRates;
  pending_checkin: boolean;
  queda_aderencia: boolean;
  attention_score: number;
  reasons: string[];
  adherence: AdherenceCarteiraSummary;
};

export type AdherenceCarteiraResponse = {
  days: number;
  as_of: string;
  gerado_em: string;
  items: AdherenceCarteiraItem[];
};
