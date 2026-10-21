-- Tabelas de overrides (sem FK se app_user não for owner — adicionar FK depois com owner).
CREATE TABLE IF NOT EXISTS public.atribuicao_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_treino_id uuid NOT NULL,
  slot_key uuid,
  campo text NOT NULL,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atribuicao_overrides_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicao_overrides_unique
  ON public.atribuicao_overrides (aluno_treino_id, slot_key, campo);

CREATE TABLE IF NOT EXISTS public.atribuicao_exercicios_adicionados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_treino_id uuid NOT NULL,
  slot_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ordem integer NOT NULL DEFAULT 1,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atribuicao_exercicios_adicionados_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicao_ex_adicionados_slot
  ON public.atribuicao_exercicios_adicionados (aluno_treino_id, slot_key);

CREATE TABLE IF NOT EXISTS public.atribuicao_exercicios_removidos (
  aluno_treino_id uuid NOT NULL,
  slot_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atribuicao_exercicios_removidos_pkey PRIMARY KEY (aluno_treino_id, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_atribuicao_overrides_aluno_treino
  ON public.atribuicao_overrides (aluno_treino_id);

CREATE INDEX IF NOT EXISTS idx_atribuicao_ex_adicionados_aluno_treino
  ON public.atribuicao_exercicios_adicionados (aluno_treino_id);

CREATE INDEX IF NOT EXISTS idx_alunos_treinos_treino_ativo
  ON public.alunos_treinos (treino_id) WHERE COALESCE(ativo, true) = true;
