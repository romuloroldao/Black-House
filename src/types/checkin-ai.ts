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
};
