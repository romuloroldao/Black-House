-- Histórico de importações de fichas (coach → aluno)
CREATE TABLE IF NOT EXISTS public.importacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  coach_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  modo text NOT NULL CHECK (modo = ANY (ARRAY['create'::text, 'enrich'::text])),
  arquivo_nome text,
  arquivo_tipo text,
  dieta_id uuid,
  replace_active_diet boolean NOT NULL DEFAULT false,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo text,
  CONSTRAINT importacoes_pkey PRIMARY KEY (id),
  CONSTRAINT importacoes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE,
  CONSTRAINT importacoes_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_importacoes_aluno_created
  ON public.importacoes (aluno_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_importacoes_coach_created
  ON public.importacoes (coach_id, created_at DESC);
