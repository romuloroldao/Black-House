-- =============================================================================
-- Grupos de equivalência alimentar (planilha logicaTabela / documento canónico)
-- Substituição: mesmo grupo + equivalência isocalórica (kcal)
-- =============================================================================

BEGIN;

ALTER TABLE public.tipos_alimentos
  ADD COLUMN IF NOT EXISTS macro_predominante text,
  ADD COLUMN IF NOT EXISTS equiv_isocalorica boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS equiv_livre boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem_exibicao integer NOT NULL DEFAULT 0;

INSERT INTO public.tipos_alimentos (nome_tipo, macro_predominante, equiv_isocalorica, equiv_livre, ordem_exibicao)
VALUES
  ('Carnes e Proteínas', 'Proteína', true, false, 10),
  ('Cereais, Raízes, Tubérculos e Frutos', 'Carboidrato', true, false, 20),
  ('Feijão e Leguminosas', 'Proteína/Carboidrato', true, false, 30),
  ('Fibras A', 'Carboidrato', true, false, 40),
  ('Fibras B', 'Carboidrato', true, false, 50),
  ('Frutas', 'Carboidrato', true, false, 60),
  ('Frutas Oleosas', 'Lipídio', true, false, 70),
  ('Leite e Derivados', 'Proteína', true, false, 80),
  ('Livre', 'Carboidrato', true, false, 90),
  ('Oleaginosas e Sementes', 'Lipídio', true, false, 100),
  ('Óleos e Gorduras', 'Lipídio', true, false, 110),
  ('Pães e Variedades', 'Carboidrato', true, false, 120),
  ('Personalizado - CARB', 'Carboidrato', true, false, 130),
  ('Personalizado - LIP', 'Lipídio', true, false, 140),
  ('Personalizado - PROT', 'Proteína', true, false, 150),
  ('Sucos Naturais e Integrais', 'Carboidrato', true, false, 160),
  ('Vegetais A (livres para consumo)', 'Carboidrato', false, true, 170),
  ('Vegetais B', 'Carboidrato', true, false, 180)
ON CONFLICT (nome_tipo) DO UPDATE SET
  macro_predominante = EXCLUDED.macro_predominante,
  equiv_isocalorica = EXCLUDED.equiv_isocalorica,
  equiv_livre = EXCLUDED.equiv_livre,
  ordem_exibicao = EXCLUDED.ordem_exibicao;

-- Migrar taxonomia legada → grupos de equivalência
WITH map AS (
  SELECT 'Proteínas'::text AS legado, 'Carnes e Proteínas'::text AS canon UNION ALL
  SELECT 'PROT', 'Carnes e Proteínas' UNION ALL
  SELECT 'Carboidratos', 'Cereais, Raízes, Tubérculos e Frutos' UNION ALL
  SELECT 'CARB', 'Cereais, Raízes, Tubérculos e Frutos' UNION ALL
  SELECT 'CEREAL', 'Cereais, Raízes, Tubérculos e Frutos' UNION ALL
  SELECT 'Leguminosas', 'Feijão e Leguminosas' UNION ALL
  SELECT 'LEGUMINOSA', 'Feijão e Leguminosas' UNION ALL
  SELECT 'Frutas', 'Frutas' UNION ALL
  SELECT 'FRUTA', 'Frutas' UNION ALL
  SELECT 'Laticínios', 'Leite e Derivados' UNION ALL
  SELECT 'LATIC', 'Leite e Derivados' UNION ALL
  SELECT 'Gorduras', 'Oleaginosas e Sementes' UNION ALL
  SELECT 'Lipídeos', 'Oleaginosas e Sementes' UNION ALL
  SELECT 'LIP', 'Oleaginosas e Sementes' UNION ALL
  SELECT 'Legumes', 'Vegetais B' UNION ALL
  SELECT 'Vegetais', 'Vegetais B' UNION ALL
  SELECT 'VEG', 'Vegetais B' UNION ALL
  SELECT 'Bebidas', 'Sucos Naturais e Integrais' UNION ALL
  SELECT 'Outros', 'Livre'
)
UPDATE public.alimentos a
SET tipo_id = c.id
FROM map m
JOIN public.tipos_alimentos l ON l.nome_tipo = m.legado
JOIN public.tipos_alimentos c ON c.nome_tipo = m.canon
WHERE a.tipo_id = l.id;

-- Óleos puros (lipídio ~100%) → Óleos e Gorduras
UPDATE public.alimentos a
SET tipo_id = t.id
FROM public.tipos_alimentos t
WHERE t.nome_tipo = 'Óleos e Gorduras'
  AND COALESCE(a.lip_por_referencia, 0) >= 80
  AND COALESCE(a.kcal_por_referencia, 0) >= 700
  AND a.tipo_id IN (
    SELECT id FROM public.tipos_alimentos
    WHERE nome_tipo IN ('Oleaginosas e Sementes', 'Gorduras', 'Lipídeos', 'LIP')
  );

-- Pães / massas no nome → Pães e Variedades
UPDATE public.alimentos a
SET tipo_id = t.id
FROM public.tipos_alimentos t
WHERE t.nome_tipo = 'Pães e Variedades'
  AND (
    lower(a.nome) LIKE '%pão%'
    OR lower(a.nome) LIKE '%pao %'
    OR lower(a.nome) LIKE '%macarr%'
    OR lower(a.nome) LIKE '%tapioca%'
    OR lower(a.nome) LIKE '%cuscuz%'
  )
  AND a.tipo_id IN (
    SELECT id FROM public.tipos_alimentos
    WHERE nome_tipo IN ('Carboidratos', 'CARB', 'Cereais, Raízes, Tubérculos e Frutos')
  );

-- Órfãos: macro predominante → grupo mais próximo
WITH alvo AS (
  SELECT a.id,
    CASE
      WHEN COALESCE(a.kcal_por_referencia, 0) > 0
           AND (COALESCE(a.lip_por_referencia, 0) * 9.0) >= (COALESCE(a.kcal_por_referencia, 0) * 0.5)
           AND COALESCE(a.lip_por_referencia, 0) >= 5
        THEN 'Oleaginosas e Sementes'
      WHEN COALESCE(a.ptn_por_referencia, 0) > COALESCE(a.cho_por_referencia, 0)
           AND COALESCE(a.ptn_por_referencia, 0) >= 7
        THEN 'Carnes e Proteínas'
      ELSE 'Cereais, Raízes, Tubérculos e Frutos'
    END AS canon
  FROM public.alimentos a
  WHERE a.tipo_id IS NULL
)
UPDATE public.alimentos a
SET tipo_id = t.id
FROM alvo
JOIN public.tipos_alimentos t ON t.nome_tipo = alvo.canon
WHERE a.id = alvo.id;

DELETE FROM public.tipos_alimentos
WHERE nome_tipo IN (
  'PROT', 'CARB', 'CEREAL', 'LATIC', 'LIP', 'FRUTA', 'VEG', 'LEGUMINOSA',
  'Proteínas', 'Carboidratos', 'Gorduras', 'Lipídeos', 'Legumes', 'Vegetais',
  'Leguminosas', 'Laticínios', 'Bebidas', 'Outros'
)
AND NOT EXISTS (SELECT 1 FROM public.alimentos x WHERE x.tipo_id = tipos_alimentos.id);

COMMIT;
