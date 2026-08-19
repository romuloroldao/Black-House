export type CheckinAiTrendsResponse = {
  summary: string;
  highlights: string[];
  weeks_analyzed: number;
  aluno_id: string;
};

export type CheckinAiDraftInsight7d = {
  text?: string | null;
  streak_days?: number;
  miss_days_recent?: number;
  rates?: {
    meal_pct?: number | null;
    workout_pct?: number | null;
  };
};

export type CheckinAiDraftRule = {
  id?: string;
  title?: string;
  body?: string;
  trigger?: string;
};

export type CheckinAiDraftResponse = {
  draft: string;
  checkin_id: string;
  aluno_id: string;
  insight_7d?: CheckinAiDraftInsight7d | null;
  coach_rules?: CheckinAiDraftRule[];
  autonomous_send?: boolean;
};
