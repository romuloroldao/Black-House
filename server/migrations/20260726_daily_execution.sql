-- Phase 1a: persistência de execução diária (refeições do plano + sessões de treino)

-- Domain de aderência para refeições do plano (workout_daily já existe)
DO $$ BEGIN
  ALTER TYPE public.task_domain ADD VALUE IF NOT EXISTS 'meal_daily';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.refeicao_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  dieta_id uuid NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  meal_key text NOT NULL,
  plano text NOT NULL DEFAULT 'A',
  concluido boolean NOT NULL DEFAULT true,
  concluido_em timestamptz,
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent', 'import')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_conclusoes_unique
    UNIQUE (aluno_id, dieta_id, data_ref, meal_key, plano),
  CONSTRAINT refeicao_conclusoes_plano_check
    CHECK (plano = 'UNICO' OR plano ~ '^[A-Z]$')
);

CREATE INDEX IF NOT EXISTS idx_refeicao_conclusoes_aluno_data
  ON public.refeicao_conclusoes (aluno_id, data_ref DESC);

CREATE TABLE IF NOT EXISTS public.treino_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  aluno_treino_id uuid REFERENCES public.alunos_treinos(id) ON DELETE SET NULL,
  treino_id uuid NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treino_sessoes_aluno_treino_dia_unique
    UNIQUE (aluno_id, treino_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_treino_sessoes_aluno_data
  ON public.treino_sessoes (aluno_id, data_ref DESC);

CREATE TABLE IF NOT EXISTS public.treino_serie_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL
    REFERENCES public.treino_sessoes(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  exercise_index int NOT NULL CHECK (exercise_index >= 0),
  exercise_name text NOT NULL,
  set_index int NOT NULL DEFAULT 1 CHECK (set_index >= 1),
  carga text,
  repeticoes numeric(8,2),
  rpe numeric(4,1) CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10)),
  dor numeric(4,1) CHECK (dor IS NULL OR (dor >= 0 AND dor <= 10)),
  concluido boolean NOT NULL DEFAULT true,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT treino_serie_logs_unique
    UNIQUE (sessao_id, exercise_index, set_index)
);

CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_aluno
  ON public.treino_serie_logs (aluno_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_sessao
  ON public.treino_serie_logs (sessao_id, exercise_index, set_index);
