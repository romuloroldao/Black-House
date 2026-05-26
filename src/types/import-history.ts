export type ImportHistoryRecord = {
  id: string;
  created_at: string;
  coach_id: string;
  aluno_id: string;
  modo: "create" | "enrich";
  arquivo_nome: string | null;
  arquivo_tipo: string | null;
  dieta_id: string | null;
  replace_active_diet: boolean;
  stats: Record<string, unknown>;
  resumo: string | null;
  aluno_nome?: string | null;
  dieta_nome?: string | null;
};
