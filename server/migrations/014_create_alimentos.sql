CREATE TABLE IF NOT EXISTS public.alimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    origem_ptn TEXT NOT NULL,
    tipo_id UUID,
    quantidade_referencia_g NUMERIC NOT NULL DEFAULT 100,
    kcal_por_referencia NUMERIC NOT NULL,
    ptn_por_referencia NUMERIC NOT NULL,
    cho_por_referencia NUMERIC NOT NULL,
    lip_por_referencia NUMERIC NOT NULL,
    info_adicional TEXT,
    autor TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alimentos_nome ON public.alimentos (nome);
CREATE INDEX IF NOT EXISTS idx_alimentos_tipo_id ON public.alimentos (tipo_id);
