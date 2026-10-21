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
  } | null;
  detalhe: {
    id: string;
    nome?: string | null;
    descricao?: string | null;
    categoria?: string | null;
    dificuldade?: string | null;
    duracao?: number | null;
  } | null;
  /** True quando a resolução veio da programação semanal */
  from_agenda?: boolean;
  agenda_dia_semana?: number | null;
  /** True quando há agenda e o dia de hoje está vazio (descanso) */
  descanso_hoje?: boolean;
};

export type AlunoHojeFotosEvolucao = {
  total: number;
  ultima_em: string | null;
  ultima_url: string | null;
  enviou_esta_semana: boolean;
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

export type AlunoHojeExecucaoRefeicao = {
  meal_key: string;
  plano: string;
  concluido?: boolean;
  concluido_em?: string | null;
  dieta_id?: string;
};

export type AlunoHojeExecucaoTreino = {
  id: string;
  status: "in_progress" | "completed" | "abandoned" | string;
  completed_indexes: number[];
  series_count: number;
  started_at?: string | null;
  completed_at?: string | null;
};

export type AlunoHojeExecucao = {
  refeicoes_concluidas: AlunoHojeExecucaoRefeicao[];
  treino_sessao: AlunoHojeExecucaoTreino | null;
};

export type AlunoHojeResponse = {
  aluno: Record<string, unknown>;
  treino: AlunoHojeTreino | null;
  dieta: Record<string, unknown> | null;
  dieta_rotacao: AlunoHojeDietaRotacao | null;
  retorno: AlunoHojeRetorno | null;
  checkin_streak: AlunoHojeCheckinStreak | null;
  fotos_evolucao: AlunoHojeFotosEvolucao | null;
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
  /** Phase 1a — execução diária server-side */
  execucao?: AlunoHojeExecucao;
  /** Phase 5 — insight comportamental */
  behavioral_insight?: AlunoHojeBehavioralInsight | null;
  gerado_em: string;
};

export type AlunoHojeBehavioralInsight = {
  available?: boolean;
  window_days?: number;
  as_of?: string;
  streak_days?: number;
  miss_days_recent?: number;
  rates?: {
    meal_pct?: number | null;
    workout_pct?: number | null;
    meal_days?: number;
    meal_expected?: number;
    workout_done?: number;
    workout_expected?: number;
  };
  tone?: "positive" | "nudge" | "neutral" | string;
  text?: string | null;
};
