export type CheckinAiTrendsResponse = {
  summary: string;
  highlights: string[];
  weeks_analyzed: number;
  aluno_id: string;
};

export type CheckinAiDraftResponse = {
  draft: string;
  checkin_id: string;
  aluno_id: string;
  insight?: {
    text: string | null;
    streak_days: number;
    miss_days_recent: number;
    rates: {
      meal_pct: number | null;
      workout_pct: number | null;
    };
  } | null;
  rules_applied?: Array<{ title: string; body: string }>;
};
