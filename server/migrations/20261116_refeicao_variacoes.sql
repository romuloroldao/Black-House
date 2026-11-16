-- Variações de preparo da refeição prescrita. Não alteram itens_dieta nem o consumo.

CREATE TABLE IF NOT EXISTS public.refeicao_variacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  dieta_id uuid NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  semana_inicio date NOT NULL,
  indice smallint NOT NULL CHECK (indice BETWEEN 1 AND 2),
  titulo text NOT NULL,
  preparo text NOT NULL,
  itens jsonb NOT NULL,
  macros jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'valida'
    CHECK (status IN ('valida', 'rejeitada', 'invalidada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_variacoes_unique
    UNIQUE (aluno_id, dieta_id, fingerprint, semana_inicio, indice)
);

CREATE INDEX IF NOT EXISTS idx_refeicao_variacoes_aluno
  ON public.refeicao_variacoes (aluno_id, dieta_id, semana_inicio DESC);

CREATE TABLE IF NOT EXISTS public.refeicao_variacao_escolhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  dieta_id uuid NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  meal_key text NOT NULL,
  plano text NOT NULL DEFAULT 'UNICO',
  variacao_id uuid NOT NULL REFERENCES public.refeicao_variacoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_variacao_escolhas_unique
    UNIQUE (aluno_id, dieta_id, data_ref, meal_key, plano)
);

CREATE INDEX IF NOT EXISTS idx_refeicao_variacao_escolhas_aluno
  ON public.refeicao_variacao_escolhas (aluno_id, data_ref DESC);
