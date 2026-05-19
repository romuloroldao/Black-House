-- Patch incremental: coerência kcal/macros (álcool) + unidade em itens_dieta
-- Executável por um utilizador com privilégios ALTER nas tabelas indicadas.

ALTER TABLE public.alimentos ADD COLUMN IF NOT EXISTS alcool_por_referencia numeric NOT NULL DEFAULT 0;

ALTER TABLE public.itens_dieta ADD COLUMN IF NOT EXISTS unidade_quantidade text NOT NULL DEFAULT 'g';

ALTER TABLE public.itens_dieta DROP CONSTRAINT IF EXISTS itens_dieta_unidade_quantidade_check;

ALTER TABLE public.itens_dieta ADD CONSTRAINT itens_dieta_unidade_quantidade_check CHECK (
  unidade_quantidade = ANY (ARRAY['g'::text, 'ml'::text, 'un'::text])
);
