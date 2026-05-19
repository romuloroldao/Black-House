-- =============================================================================
-- Normalização de taxonomia de alimentos (idempotente)
-- - Garante categorias canónicas: Proteínas, Carboidratos, Gorduras,
--   Frutas, Legumes, Laticínios, Leguminosas, Bebidas, Outros
-- - Migra alimentos de tipos legados (PROT/CARB/LATIC/LIP/FRUTA/VEG/CEREAL/LEGUMINOSA)
-- - Atribui tipo_id aos órfãos via macro predominante
-- - Remove tipos legados após migração
-- =============================================================================

BEGIN;

-- 1) Garantir categorias canónicas
INSERT INTO public.tipos_alimentos (nome_tipo)
VALUES
  ('Proteínas'),
  ('Carboidratos'),
  ('Gorduras'),
  ('Frutas'),
  ('Legumes'),
  ('Laticínios'),
  ('Leguminosas'),
  ('Bebidas'),
  ('Outros')
ON CONFLICT (nome_tipo) DO NOTHING;

-- 2) Mapear tipos legados → canónicos
WITH map AS (
  SELECT 'PROT'::text AS legado, 'Proteínas'::text AS canon UNION ALL
  SELECT 'CARB',         'Carboidratos' UNION ALL
  SELECT 'CEREAL',       'Carboidratos' UNION ALL
  SELECT 'LATIC',        'Laticínios'   UNION ALL
  SELECT 'LIP',          'Gorduras'     UNION ALL
  SELECT 'FRUTA',        'Frutas'       UNION ALL
  SELECT 'VEG',          'Legumes'      UNION ALL
  SELECT 'LEGUMINOSA',   'Leguminosas'
)
UPDATE public.alimentos a
SET tipo_id = c.id
FROM map m
JOIN public.tipos_alimentos l ON l.nome_tipo = m.legado
JOIN public.tipos_alimentos c ON c.nome_tipo = m.canon
WHERE a.tipo_id = l.id;

-- 3) Atribuir órfãos por macro predominante (apenas onde tipo_id é NULL)
--    Regras:
--      kcal_lip >= 50% das calorias e lip > 5g/100g  →  Gorduras
--      ptn > cho e ptn >= 7g/100g                    →  Proteínas
--      caso contrário                                →  Carboidratos
WITH alvo AS (
  SELECT a.id,
    CASE
      WHEN COALESCE(a.kcal_por_referencia, 0) > 0
           AND (COALESCE(a.lip_por_referencia, 0) * 9.0)
               >= (COALESCE(a.kcal_por_referencia, 0) * 0.5)
           AND COALESCE(a.lip_por_referencia, 0) >= 5
        THEN 'Gorduras'
      WHEN COALESCE(a.ptn_por_referencia, 0) > COALESCE(a.cho_por_referencia, 0)
           AND COALESCE(a.ptn_por_referencia, 0) >= 7
        THEN 'Proteínas'
      ELSE 'Carboidratos'
    END AS canon
  FROM public.alimentos a
  WHERE a.tipo_id IS NULL
)
UPDATE public.alimentos a
SET tipo_id = t.id
FROM alvo
JOIN public.tipos_alimentos t ON t.nome_tipo = alvo.canon
WHERE a.id = alvo.id;

-- 4) Remover tipos legados (já não há referências)
DELETE FROM public.tipos_alimentos
WHERE nome_tipo IN ('PROT','CARB','CEREAL','LATIC','LIP','FRUTA','VEG','LEGUMINOSA');

COMMIT;

-- 5) Resumo final
SELECT t.nome_tipo, COUNT(a.id) AS total
FROM public.tipos_alimentos t
LEFT JOIN public.alimentos a ON a.tipo_id = t.id
GROUP BY t.nome_tipo
ORDER BY total DESC;

SELECT COUNT(*) AS orfaos_restantes FROM public.alimentos WHERE tipo_id IS NULL;
