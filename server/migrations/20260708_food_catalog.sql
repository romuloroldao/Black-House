-- =============================================================================
-- Catálogo Inteligente de Alimentos — versões, auditoria, snapshots em dietas
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Normalização de nome (sem dependência de unaccent)
CREATE OR REPLACE FUNCTION public.normalize_food_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    trim(
      regexp_replace(
        translate(
          COALESCE(raw, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        ),
        '[^a-z0-9 ]',
        ' ',
        'g'
      )
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- alimentos — colunas de catálogo
-- ---------------------------------------------------------------------------
ALTER TABLE public.alimentos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES app_auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS versao_actual integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.alimentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nome_normalizado text,
  ADD COLUMN IF NOT EXISTS unidade_referencia text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS fibra_por_referencia numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acucar_por_referencia numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sodio_por_referencia_mg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualidade_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flags_qualidade jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.alimentos DROP CONSTRAINT IF EXISTS alimentos_status_check;
ALTER TABLE public.alimentos ADD CONSTRAINT alimentos_status_check
  CHECK (status IN ('active', 'draft', 'deprecated', 'merged'));

ALTER TABLE public.alimentos DROP CONSTRAINT IF EXISTS alimentos_scope_check;
ALTER TABLE public.alimentos ADD CONSTRAINT alimentos_scope_check
  CHECK (scope IN ('platform', 'shared', 'coach'));

ALTER TABLE public.alimentos DROP CONSTRAINT IF EXISTS alimentos_unidade_referencia_check;
ALTER TABLE public.alimentos ADD CONSTRAINT alimentos_unidade_referencia_check
  CHECK (unidade_referencia IN ('g', 'ml', 'un'));

UPDATE public.alimentos
SET nome_normalizado = public.normalize_food_name(nome)
WHERE nome_normalizado IS NULL OR nome_normalizado = '';

UPDATE public.alimentos
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- Substituir UNIQUE literal por índice normalizado por scope/coach
ALTER TABLE public.alimentos DROP CONSTRAINT IF EXISTS alimentos_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alimentos_nome_norm_scope
  ON public.alimentos (
    nome_normalizado,
    COALESCE(coach_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_alimentos_nome_trgm
  ON public.alimentos USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alimentos_nome_norm_trgm
  ON public.alimentos USING gin (nome_normalizado gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_alimentos_status_updated
  ON public.alimentos (status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Versões imutáveis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alimento_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alimento_id uuid NOT NULL REFERENCES public.alimentos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  nome text NOT NULL,
  tipo_id uuid REFERENCES public.tipos_alimentos(id) ON DELETE SET NULL,
  unidade_referencia text NOT NULL DEFAULT 'g',
  quantidade_referencia numeric NOT NULL,
  kcal_por_referencia numeric NOT NULL,
  ptn_por_referencia numeric NOT NULL,
  cho_por_referencia numeric NOT NULL,
  lip_por_referencia numeric NOT NULL,
  alcool_por_referencia numeric NOT NULL DEFAULT 0,
  fibra_por_referencia numeric NOT NULL DEFAULT 0,
  acucar_por_referencia numeric NOT NULL DEFAULT 0,
  sodio_por_referencia_mg numeric NOT NULL DEFAULT 0,
  origem_ptn text NOT NULL,
  info_adicional text,
  motivo_alteracao text,
  criado_por uuid REFERENCES app_auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alimento_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_alimento_versoes_alimento
  ON public.alimento_versoes (alimento_id, versao DESC);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alimento_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alimento_id uuid NOT NULL REFERENCES public.alimentos(id) ON DELETE CASCADE,
  versao_de integer,
  versao_para integer,
  actor_id uuid REFERENCES app_auth.users(id) ON DELETE SET NULL,
  actor_role text,
  acao text NOT NULL,
  campo text,
  valor_anterior jsonb,
  valor_novo jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alimento_audit_log_acao_check
    CHECK (acao IN ('create', 'update', 'merge', 'deprecate', 'restore'))
);

CREATE INDEX IF NOT EXISTS idx_alimento_audit_alimento
  ON public.alimento_audit_log (alimento_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- Aliases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alimento_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alimento_id uuid NOT NULL REFERENCES public.alimentos(id) ON DELETE CASCADE,
  alias_normalizado text NOT NULL,
  fonte text,
  UNIQUE (alias_normalizado, alimento_id)
);

CREATE INDEX IF NOT EXISTS idx_alimento_aliases_norm
  ON public.alimento_aliases (alias_normalizado);

-- ---------------------------------------------------------------------------
-- Snapshots em itens_dieta
-- ---------------------------------------------------------------------------
ALTER TABLE public.itens_dieta
  ADD COLUMN IF NOT EXISTS alimento_versao_id uuid REFERENCES public.alimento_versoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alimento_nome_snapshot text,
  ADD COLUMN IF NOT EXISTS nutrientes_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_itens_dieta_alimento_versao
  ON public.itens_dieta (alimento_versao_id)
  WHERE alimento_versao_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill: versão 1 para alimentos existentes
-- ---------------------------------------------------------------------------
INSERT INTO public.alimento_versoes (
  alimento_id, versao, nome, tipo_id, unidade_referencia, quantidade_referencia,
  kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
  alcool_por_referencia, fibra_por_referencia, acucar_por_referencia, sodio_por_referencia_mg,
  origem_ptn, info_adicional, motivo_alteracao, criado_por, criado_em
)
SELECT
  a.id,
  1,
  a.nome,
  a.tipo_id,
  COALESCE(a.unidade_referencia, 'g'),
  COALESCE(a.quantidade_referencia_g, 100),
  a.kcal_por_referencia,
  a.ptn_por_referencia,
  a.cho_por_referencia,
  a.lip_por_referencia,
  COALESCE(a.alcool_por_referencia, 0),
  COALESCE(a.fibra_por_referencia, 0),
  COALESCE(a.acucar_por_referencia, 0),
  COALESCE(a.sodio_por_referencia_mg, 0),
  a.origem_ptn,
  a.info_adicional,
  'Migração inicial do catálogo',
  -- autor é text legado; só castar UUID válido (evita falhar o backfill)
  CASE
    WHEN a.autor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN a.autor::uuid
    ELSE NULL
  END,
  COALESCE(a.created_at, now())
FROM public.alimentos a
WHERE NOT EXISTS (
  SELECT 1 FROM public.alimento_versoes v WHERE v.alimento_id = a.id AND v.versao = 1
);

UPDATE public.alimentos a
SET versao_actual = 1
WHERE versao_actual IS NULL OR versao_actual < 1;

-- Backfill snapshots em itens_dieta existentes
UPDATE public.itens_dieta i
SET
  alimento_versao_id = v.id,
  alimento_nome_snapshot = a.nome,
  nutrientes_snapshot = jsonb_build_object(
    'nome', a.nome,
    'quantidade_referencia', COALESCE(a.quantidade_referencia_g, 100),
    'unidade_referencia', COALESCE(a.unidade_referencia, 'g'),
    'kcal', a.kcal_por_referencia,
    'ptn', a.ptn_por_referencia,
    'cho', a.cho_por_referencia,
    'lip', a.lip_por_referencia,
    'alcool', COALESCE(a.alcool_por_referencia, 0),
    'fibra', COALESCE(a.fibra_por_referencia, 0),
    'acucar', COALESCE(a.acucar_por_referencia, 0),
    'sodio_mg', COALESCE(a.sodio_por_referencia_mg, 0),
    'versao', COALESCE(a.versao_actual, 1)
  )
FROM public.alimentos a
JOIN public.alimento_versoes v ON v.alimento_id = a.id AND v.versao = 1
WHERE i.alimento_id = a.id
  AND i.alimento_versao_id IS NULL;

-- Trigger: snapshot automático em novos itens_dieta
CREATE OR REPLACE FUNCTION public.itens_dieta_fill_nutrient_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  a public.alimentos%ROWTYPE;
  v_id uuid;
  v_versao integer;
BEGIN
  IF NEW.alimento_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO a FROM public.alimentos WHERE id = NEW.alimento_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.alimento_versao_id IS NOT NULL AND NEW.nutrientes_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT av.id, av.versao INTO v_id, v_versao
  FROM public.alimento_versoes av
  WHERE av.alimento_id = a.id AND av.versao = a.versao_actual
  LIMIT 1;

  IF v_id IS NULL THEN
    SELECT av.id, av.versao INTO v_id, v_versao
    FROM public.alimento_versoes av
    WHERE av.alimento_id = a.id
    ORDER BY av.versao DESC
    LIMIT 1;
  END IF;

  NEW.alimento_versao_id := COALESCE(NEW.alimento_versao_id, v_id);
  NEW.alimento_nome_snapshot := COALESCE(NEW.alimento_nome_snapshot, a.nome);
  NEW.nutrientes_snapshot := COALESCE(
    NEW.nutrientes_snapshot,
    jsonb_build_object(
      'nome', a.nome,
      'quantidade_referencia', COALESCE(a.quantidade_referencia_g, 100),
      'unidade_referencia', COALESCE(a.unidade_referencia, 'g'),
      'kcal', a.kcal_por_referencia,
      'ptn', a.ptn_por_referencia,
      'cho', a.cho_por_referencia,
      'lip', a.lip_por_referencia,
      'alcool', COALESCE(a.alcool_por_referencia, 0),
      'fibra', COALESCE(a.fibra_por_referencia, 0),
      'acucar', COALESCE(a.acucar_por_referencia, 0),
      'sodio_mg', COALESCE(a.sodio_por_referencia_mg, 0),
      'versao', COALESCE(v_versao, a.versao_actual, 1)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_itens_dieta_fill_snapshot ON public.itens_dieta;
CREATE TRIGGER trg_itens_dieta_fill_snapshot
  BEFORE INSERT OR UPDATE OF alimento_id ON public.itens_dieta
  FOR EACH ROW
  EXECUTE FUNCTION public.itens_dieta_fill_nutrient_snapshot();

COMMIT;
