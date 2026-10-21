-- Ciclo rotativo Plano A / B (ex.: 3 dias A, 1 dia B)
ALTER TABLE public.dietas
  ADD COLUMN IF NOT EXISTS rotacao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotacao_dias_plano_a smallint,
  ADD COLUMN IF NOT EXISTS rotacao_dias_plano_b smallint,
  ADD COLUMN IF NOT EXISTS rotacao_plano_inicial text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS rotacao_data_inicio date;

ALTER TABLE public.dietas DROP CONSTRAINT IF EXISTS dietas_rotacao_plano_inicial_check;
ALTER TABLE public.dietas ADD CONSTRAINT dietas_rotacao_plano_inicial_check
  CHECK (rotacao_plano_inicial IN ('A', 'B'));

ALTER TABLE public.dietas DROP CONSTRAINT IF EXISTS dietas_rotacao_dias_positive_check;
ALTER TABLE public.dietas ADD CONSTRAINT dietas_rotacao_dias_positive_check
  CHECK (
    (NOT rotacao_ativa)
    OR (
      COALESCE(rotacao_dias_plano_a, 0) >= 1
      AND COALESCE(rotacao_dias_plano_b, 0) >= 1
    )
  );

COMMENT ON COLUMN public.dietas.rotacao_ativa IS 'Se true, o aluno segue ciclo automático A/B (dias definidos pelo coach)';
COMMENT ON COLUMN public.dietas.rotacao_dias_plano_a IS 'Dias consecutivos do Plano A em cada ciclo';
COMMENT ON COLUMN public.dietas.rotacao_dias_plano_b IS 'Dias consecutivos do Plano B em cada ciclo';
