-- Diário alimentar: refeições registadas pelo aluno (estimativa por foto / ajuste manual)

BEGIN;

CREATE TABLE IF NOT EXISTS public.refeicoes_registradas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  nome_sugerido text,
  imagem_path text,
  kcal numeric NOT NULL DEFAULT 0,
  ptn numeric NOT NULL DEFAULT 0,
  cho numeric NOT NULL DEFAULT 0,
  lip numeric NOT NULL DEFAULT 0,
  ai_kcal numeric,
  ai_ptn numeric,
  ai_cho numeric,
  ai_lip numeric,
  origem text NOT NULL DEFAULT 'AI_ESTIMATE',
  ai_confidence numeric,
  ai_uncertainties jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_raw jsonb,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicoes_registradas_pkey PRIMARY KEY (id),
  CONSTRAINT refeicoes_registradas_aluno_id_fkey
    FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE,
  CONSTRAINT refeicoes_registradas_origem_check
    CHECK (origem IN ('AI_ESTIMATE', 'USER_ADJUSTED'))
);

CREATE INDEX IF NOT EXISTS idx_refeicoes_registradas_aluno_em
  ON public.refeicoes_registradas (aluno_id, registrado_em DESC);

CREATE TABLE IF NOT EXISTS public.refeicao_registrada_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  refeicao_id uuid NOT NULL,
  nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'g',
  kcal numeric NOT NULL DEFAULT 0,
  ptn numeric NOT NULL DEFAULT 0,
  cho numeric NOT NULL DEFAULT 0,
  lip numeric NOT NULL DEFAULT 0,
  alimento_id uuid,
  fonte text NOT NULL DEFAULT 'AI',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_registrada_itens_pkey PRIMARY KEY (id),
  CONSTRAINT refeicao_registrada_itens_refeicao_id_fkey
    FOREIGN KEY (refeicao_id) REFERENCES public.refeicoes_registradas(id) ON DELETE CASCADE,
  CONSTRAINT refeicao_registrada_itens_alimento_id_fkey
    FOREIGN KEY (alimento_id) REFERENCES public.alimentos(id) ON DELETE SET NULL,
  CONSTRAINT refeicao_registrada_itens_fonte_check
    CHECK (fonte IN ('AI', 'USER'))
);

CREATE INDEX IF NOT EXISTS idx_refeicao_registrada_itens_refeicao
  ON public.refeicao_registrada_itens (refeicao_id, ordem);

COMMENT ON TABLE public.refeicoes_registradas IS
  'Registos de refeição livre/consumo do aluno (estimativa IA + ajustes do utilizador)';
COMMENT ON COLUMN public.refeicoes_registradas.origem IS
  'AI_ESTIMATE = confirmado sem alterações materiais; USER_ADJUSTED = utilizador alterou valores';
COMMENT ON COLUMN public.refeicoes_registradas.imagem_path IS
  'Caminho relativo autenticado, ex. /api/uploads/storage/meal-photos/{alunoId}/{file}';

COMMIT;
