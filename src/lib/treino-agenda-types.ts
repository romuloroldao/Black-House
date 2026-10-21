/** Tipos da programação semanal de sessões de treino */

/** ISO: 1=Segunda … 7=Domingo */
export type DiaSemanaIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TreinoAgendaSession = {
  id?: string;
  dia_semana: number;
  aluno_treino_id: string;
  treino_id?: string;
  treino_nome?: string | null;
  treino_categoria?: string | null;
  treino_dificuldade?: string | null;
  ordem?: number;
};

export type TreinoAgendaResponse = {
  aluno_id: string;
  sessions: TreinoAgendaSession[];
  sessoes_count: number;
};

export const DIAS_SEMANA_LABELS: Record<DiaSemanaIso, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

export const DIAS_SEMANA_ORDEM: DiaSemanaIso[] = [1, 2, 3, 4, 5, 6, 7];
