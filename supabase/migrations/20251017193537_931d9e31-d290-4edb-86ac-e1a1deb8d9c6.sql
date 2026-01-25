-- Etapa 1: Criar tabela tipos_alimentos
CREATE TABLE IF NOT EXISTS public.tipos_alimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_tipo TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Etapa 2: Criar nova tabela alimentos_novo com schema correto
CREATE TABLE public.alimentos_novo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    quantidade_referencia_g NUMERIC(10,2) NOT NULL DEFAULT 100,
    kcal_por_referencia NUMERIC(10,2) NOT NULL,
    cho_por_referencia NUMERIC(10,2) NOT NULL,
    ptn_por_referencia NUMERIC(10,2) NOT NULL,
    lip_por_referencia NUMERIC(10,2) NOT NULL,
    origem_ptn TEXT NOT NULL CHECK (origem_ptn IN ('Vegetal', 'Animal', 'Mista', 'N/A')),
    tipo_id UUID REFERENCES public.tipos_alimentos(id),
    info_adicional TEXT,
    autor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Etapa 3: Migrar tipos de alimentos
INSERT INTO public.tipos_alimentos (nome_tipo)
SELECT DISTINCT grupo 
FROM public.alimentos 
WHERE grupo IS NOT NULL AND grupo != ''
ON CONFLICT (nome_tipo) DO NOTHING;

-- Etapa 4: Migrar dados da tabela antiga para a nova (mapeando IDs)
INSERT INTO public.alimentos_novo (
    id,
    nome, 
    quantidade_referencia_g, 
    kcal_por_referencia, 
    cho_por_referencia, 
    ptn_por_referencia, 
    lip_por_referencia, 
    origem_ptn, 
    tipo_id,
    created_at
)
SELECT 
    gen_random_uuid(),
    a.nome,
    a.quantidade::NUMERIC,
    a.kcal::NUMERIC,
    a.carboidratos::NUMERIC,
    a.proteinas::NUMERIC,
    a.lipidios::NUMERIC,
    COALESCE(a.origem, 'N/A'),
    t.id,
    a.created_at
FROM public.alimentos a
LEFT JOIN public.tipos_alimentos t ON t.nome_tipo = a.grupo
ON CONFLICT (nome) DO NOTHING;

-- Etapa 5: Criar tabela de mapeamento temporária (bigint -> UUID)
CREATE TEMP TABLE alimento_id_map AS
SELECT 
    a_old.id as old_id,
    a_old.nome,
    a_new.id as new_id
FROM public.alimentos a_old
INNER JOIN public.alimentos_novo a_new ON a_old.nome = a_new.nome;

-- Etapa 6: Adicionar coluna temporária em itens_dieta
ALTER TABLE public.itens_dieta ADD COLUMN alimento_id_novo UUID;

-- Etapa 7: Atualizar itens_dieta com novos IDs
UPDATE public.itens_dieta id
SET alimento_id_novo = m.new_id
FROM alimento_id_map m
WHERE id.alimento_id = m.old_id;

-- Etapa 8: Dropar constraint antiga
ALTER TABLE public.itens_dieta DROP CONSTRAINT IF EXISTS itens_dieta_alimento_id_fkey;

-- Etapa 9: Dropar coluna antiga
ALTER TABLE public.itens_dieta DROP COLUMN alimento_id;

-- Etapa 10: Renomear coluna nova
ALTER TABLE public.itens_dieta RENAME COLUMN alimento_id_novo TO alimento_id;

-- Etapa 11: Drop tabela antiga e renomear nova
DROP TABLE public.alimentos;
ALTER TABLE public.alimentos_novo RENAME TO alimentos;

-- Etapa 12: Criar constraint nova
ALTER TABLE public.itens_dieta 
ADD CONSTRAINT itens_dieta_alimento_id_fkey 
FOREIGN KEY (alimento_id) REFERENCES public.alimentos(id);

-- Etapa 13: Recriar políticas RLS
ALTER TABLE public.alimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view alimentos"
ON public.alimentos FOR SELECT
USING (true);

ALTER TABLE public.tipos_alimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tipos_alimentos"
ON public.tipos_alimentos FOR SELECT
USING (true);

-- Etapa 14: Criar função calcular_nutrientes
CREATE OR REPLACE FUNCTION public.calcular_nutrientes(
    alimento_id UUID,
    quantidade_consumida_g NUMERIC(10,2)
) RETURNS TABLE (
    nome_alimento TEXT,
    kcal NUMERIC(10,2),
    cho NUMERIC(10,2),
    ptn NUMERIC(10,2),
    lip NUMERIC(10,2),
    origem_ptn TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    fator NUMERIC(10,4);
BEGIN
    SELECT
        quantidade_consumida_g / a.quantidade_referencia_g
    INTO fator
    FROM public.alimentos a
    WHERE a.id = alimento_id;

    RETURN QUERY
    SELECT
        a.nome,
        a.kcal_por_referencia * fator AS kcal,
        a.cho_por_referencia * fator AS cho,
        a.ptn_por_referencia * fator AS ptn,
        a.lip_por_referencia * fator AS lip,
        a.origem_ptn
    FROM public.alimentos a
    WHERE a.id = alimento_id;
END;
$$;

-- Etapa 15: Criar índices para performance
CREATE INDEX idx_alimentos_tipo_id ON public.alimentos(tipo_id);
CREATE INDEX idx_alimentos_nome ON public.alimentos(nome);
CREATE INDEX idx_tipos_alimentos_nome ON public.tipos_alimentos(nome_tipo);
CREATE INDEX idx_itens_dieta_alimento_id ON public.itens_dieta(alimento_id);