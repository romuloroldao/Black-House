-- Programação semanal de sessões de treino (referências reutilizáveis a alunos_treinos).
-- dia_semana ISO: 1=Segunda … 7=Domingo. MVP: 1 sessão por dia (UNIQUE aluno+dia).
-- O mesmo aluno_treino_id PODE aparecer em vários dias (sem unique em aluno_treino_id).

CREATE TABLE IF NOT EXISTS public.aluno_treino_agenda (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  dia_semana smallint NOT NULL,
  aluno_treino_id uuid NOT NULL,
  ordem smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aluno_treino_agenda_pkey PRIMARY KEY (id),
  CONSTRAINT aluno_treino_agenda_aluno_id_fkey
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE,
  CONSTRAINT aluno_treino_agenda_aluno_treino_id_fkey
    FOREIGN KEY (aluno_treino_id) REFERENCES public.alunos_treinos(id) ON DELETE CASCADE,
  CONSTRAINT aluno_treino_agenda_dia_semana_check
    CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT aluno_treino_agenda_aluno_dia_unique
    UNIQUE (aluno_id, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_aluno_treino_agenda_aluno_id
  ON public.aluno_treino_agenda (aluno_id);

CREATE INDEX IF NOT EXISTS idx_aluno_treino_agenda_aluno_treino_id
  ON public.aluno_treino_agenda (aluno_treino_id);

COMMENT ON TABLE public.aluno_treino_agenda IS
  'Sessões semanais: cada linha é uma ocorrência que referencia um alunos_treinos (reutilizável).';
COMMENT ON COLUMN public.aluno_treino_agenda.dia_semana IS
  'ISO 8601: 1=Segunda … 7=Domingo';
COMMENT ON COLUMN public.aluno_treino_agenda.ordem IS
  'Reservado para multi-sessão no mesmo dia (MVP=0)';
