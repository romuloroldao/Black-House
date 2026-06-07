-- Ciclo rotativo flexível: N cardápios (A, B, C, …) com dias por bloco

ALTER TABLE public.dietas
  ADD COLUMN IF NOT EXISTS rotacao_sequencia jsonb;

COMMENT ON COLUMN public.dietas.rotacao_sequencia IS
  'Ciclo de rotação: [{ "plano": "A", "dias": 3 }, { "plano": "B", "dias": 1 }, …]';

-- Preencher a partir dos campos legados A/B
UPDATE public.dietas
SET rotacao_sequencia = jsonb_build_array(
  jsonb_build_object('plano', 'A', 'dias', rotacao_dias_plano_a),
  jsonb_build_object('plano', 'B', 'dias', rotacao_dias_plano_b)
)
WHERE rotacao_ativa = true
  AND rotacao_dias_plano_a IS NOT NULL
  AND rotacao_dias_plano_b IS NOT NULL
  AND rotacao_sequencia IS NULL;
