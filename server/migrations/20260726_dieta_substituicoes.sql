-- Phase 4: substituições diárias do aluno (não mutam o plano do coach)

CREATE TABLE IF NOT EXISTS public.refeicao_substituicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  dieta_id uuid NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  item_dieta_id uuid NOT NULL REFERENCES public.itens_dieta(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  plano text NOT NULL DEFAULT 'A',
  alimento_original_id uuid NOT NULL REFERENCES public.alimentos(id),
  alimento_substituto_id uuid NOT NULL REFERENCES public.alimentos(id),
  quantidade_original numeric(12,3),
  quantidade_substituto numeric(12,3) NOT NULL,
  unidade_original text,
  unidade_substituto text NOT NULL DEFAULT 'g',
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_substituicoes_unique
    UNIQUE (aluno_id, item_dieta_id, data_ref, plano),
  CONSTRAINT refeicao_substituicoes_plano_check
    CHECK (plano = 'UNICO' OR plano ~ '^[A-Z]$')
);

CREATE INDEX IF NOT EXISTS idx_refeicao_substituicoes_aluno_data
  ON public.refeicao_substituicoes (aluno_id, data_ref DESC);

CREATE INDEX IF NOT EXISTS idx_refeicao_substituicoes_dieta_data
  ON public.refeicao_substituicoes (dieta_id, data_ref DESC);
