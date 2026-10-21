-- Atribuição por referência: overrides granulares em vez de clonar treinos inteiros.
-- alunos_treinos.treino_id passa a apontar ao template; personalizações ficam nas tabelas abaixo.

ALTER TABLE public.treinos
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

ALTER TABLE public.alunos_treinos
  ADD COLUMN IF NOT EXISTS template_versao integer;

COMMENT ON COLUMN public.treinos.versao IS 'Versão do template; incrementa quando exercícios/metadados mudam';
COMMENT ON COLUMN public.alunos_treinos.template_versao IS 'Versão do template no momento da atribuição';

CREATE TABLE IF NOT EXISTS public.atribuicao_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_treino_id uuid NOT NULL,
  slot_key uuid,
  campo text NOT NULL,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atribuicao_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT atribuicao_overrides_aluno_treino_id_fkey
    FOREIGN KEY (aluno_treino_id) REFERENCES public.alunos_treinos(id) ON DELETE CASCADE
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
  CONSTRAINT atribuicao_exercicios_adicionados_pkey PRIMARY KEY (id),
  CONSTRAINT atribuicao_exercicios_adicionados_aluno_treino_id_fkey
    FOREIGN KEY (aluno_treino_id) REFERENCES public.alunos_treinos(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atribuicao_ex_adicionados_slot
  ON public.atribuicao_exercicios_adicionados (aluno_treino_id, slot_key);

CREATE TABLE IF NOT EXISTS public.atribuicao_exercicios_removidos (
  aluno_treino_id uuid NOT NULL,
  slot_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atribuicao_exercicios_removidos_pkey PRIMARY KEY (aluno_treino_id, slot_key),
  CONSTRAINT atribuicao_exercicios_removidos_aluno_treino_id_fkey
    FOREIGN KEY (aluno_treino_id) REFERENCES public.alunos_treinos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_atribuicao_overrides_aluno_treino
  ON public.atribuicao_overrides (aluno_treino_id);

CREATE INDEX IF NOT EXISTS idx_atribuicao_ex_adicionados_aluno_treino
  ON public.atribuicao_exercicios_adicionados (aluno_treino_id);

CREATE INDEX IF NOT EXISTS idx_alunos_treinos_treino_ativo
  ON public.alunos_treinos (treino_id) WHERE COALESCE(ativo, true) = true;
