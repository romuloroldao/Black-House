/** Resposta de GET /api/alunos/me/hoje */

export type AlunoHojeRetorno = {
  date: string;
  days: number;
  label: string;
  source: "dieta" | "treino";
  plan_name?: string | null;
  overdue: boolean;
};

export type AlunoHojePendencia = {
  id: string;
  title: string;
  description: string;
  tab: string;
  priority: "high" | "normal";
  search_params?: Record<string, string>;
};

export type AlunoHojeTreino = {
  vinculo: {
    id: string;
    aluno_id: string;
    treino_id: string;
    ativo?: boolean;
    data_retorno?: string | null;
    data_inicio?: string | null;
  };
  detalhe: {
    id: string;
    nome?: string | null;
    descricao?: string | null;
    categoria?: string | null;
    dificuldade?: string | null;
    duracao?: number | null;
  };
};

export type AlunoHojeCheckinStreak = {
  semanas_consecutivas: number;
  fez_esta_semana: boolean;
  total_checkins: number;
  badge: string | null;
};

export type AlunoHojeDietaRotacao = {
  plano: "A" | "B";
  cycle_summary: string;
  today_label: string;
  day_in_block: number;
  block_length: number;
  cycle_length: number;
};

export type AlunoHojeResponse = {
  aluno: Record<string, unknown>;
  treino: AlunoHojeTreino | null;
  dieta: Record<string, unknown> | null;
  dieta_rotacao: AlunoHojeDietaRotacao | null;
  retorno: AlunoHojeRetorno | null;
  checkin_streak: AlunoHojeCheckinStreak | null;
  pendencias: AlunoHojePendencia[];
  proximos_eventos: Array<{
    id: string;
    titulo?: string;
    data_evento: string;
    hora_evento?: string | null;
    tipo?: string;
    status?: string;
  }>;
  contadores: {
    unread_chat: number;
    unread_avisos: number;
    checkin_due: boolean;
    pendencias_total: number;
  };
  gerado_em: string;
};
