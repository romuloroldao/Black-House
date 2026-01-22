-- Script para importar dados da Tabela TACO (Tabela Brasileira de Composição de Alimentos)
-- Data: 12 de Janeiro de 2026
-- 
-- Este script cria os tipos de alimentos e insere uma amostra dos principais alimentos da TACO
-- Para importação completa, use o script Node.js adaptado

-- ============================================
-- 1. CRIAR TIPOS DE ALIMENTOS
-- ============================================

-- Inserir tipos de alimentos (se não existirem)
INSERT INTO public.tipos_alimentos (nome_tipo) 
VALUES 
    ('PROT'),    -- Proteínas
    ('CARB'),    -- Carboidratos
    ('LIP'),     -- Lipídios/Gorduras
    ('VEG'),     -- Vegetais
    ('LATIC'),   -- Laticínios
    ('FRUTA'),   -- Frutas
    ('CEREAL'),  -- Cereais
    ('LEGUMINOSA') -- Leguminosas
ON CONFLICT (nome_tipo) DO NOTHING;

-- ============================================
-- 2. INSERIR ALIMENTOS DA TACO
-- ============================================

-- Função auxiliar para obter tipo_id
DO $$
DECLARE
    tipo_prot_id uuid;
    tipo_carb_id uuid;
    tipo_lip_id uuid;
    tipo_veg_id uuid;
    tipo_latic_id uuid;
    tipo_fruta_id uuid;
    tipo_cereal_id uuid;
    tipo_leguminosa_id uuid;
BEGIN
    -- Obter IDs dos tipos
    SELECT id INTO tipo_prot_id FROM public.tipos_alimentos WHERE nome_tipo = 'PROT';
    SELECT id INTO tipo_carb_id FROM public.tipos_alimentos WHERE nome_tipo = 'CARB';
    SELECT id INTO tipo_lip_id FROM public.tipos_alimentos WHERE nome_tipo = 'LIP';
    SELECT id INTO tipo_veg_id FROM public.tipos_alimentos WHERE nome_tipo = 'VEG';
    SELECT id INTO tipo_latic_id FROM public.tipos_alimentos WHERE nome_tipo = 'LATIC';
    SELECT id INTO tipo_fruta_id FROM public.tipos_alimentos WHERE nome_tipo = 'FRUTA';
    SELECT id INTO tipo_cereal_id FROM public.tipos_alimentos WHERE nome_tipo = 'CEREAL';
    SELECT id INTO tipo_leguminosa_id FROM public.tipos_alimentos WHERE nome_tipo = 'LEGUMINOSA';

    -- Inserir alimentos principais da TACO
    -- Dados baseados na Tabela Brasileira de Composição de Alimentos (TACO 4ª edição)
    
    INSERT INTO public.alimentos (
        nome, 
        quantidade_referencia_g, 
        kcal_por_referencia, 
        cho_por_referencia, 
        ptn_por_referencia, 
        lip_por_referencia, 
        origem_ptn, 
        tipo_id, 
        info_adicional, 
        autor
    ) VALUES
    -- CEREAIS E DERIVADOS
    ('Arroz branco cozido', 100, 130, 28.1, 2.5, 0.2, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Arroz integral cozido', 100, 123, 25.8, 2.6, 1.0, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Macarrão cozido', 100, 101, 21.2, 3.0, 0.2, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Pão francês', 100, 300, 58.6, 7.6, 3.1, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Pão de forma', 100, 253, 49.9, 8.4, 2.1, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Aveia em flocos', 100, 394, 66.6, 13.9, 8.5, 'Vegetal', tipo_cereal_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- LEGUMINOSAS
    ('Feijão carioca cozido', 100, 76, 13.6, 4.8, 0.5, 'Vegetal', tipo_leguminosa_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Feijão preto cozido', 100, 77, 14.0, 4.5, 0.5, 'Vegetal', tipo_leguminosa_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Lentilha cozida', 100, 93, 16.3, 6.3, 0.4, 'Vegetal', tipo_leguminosa_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Grão-de-bico cozido', 100, 144, 27.4, 8.9, 2.1, 'Vegetal', tipo_leguminosa_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Soja cozida', 100, 151, 5.2, 12.5, 6.2, 'Vegetal', tipo_leguminosa_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- CARNES E OVOS
    ('Carne bovina grelhada', 100, 219, 0, 32.0, 9.4, 'Animal', tipo_prot_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Frango grelhado', 100, 165, 0, 31.0, 3.6, 'Animal', tipo_prot_id, 'Peito sem pele. Fonte: TACO 4ª edição', 'TACO'),
    ('Peixe assado', 100, 164, 0, 26.0, 6.0, 'Animal', tipo_prot_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Ovo inteiro cozido', 100, 155, 1.1, 13.0, 10.6, 'Animal', tipo_prot_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Peito de peru', 100, 111, 1.5, 24.0, 1.5, 'Animal', tipo_prot_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- LATICÍNIOS
    ('Leite integral', 100, 61, 4.8, 3.2, 3.3, 'Animal', tipo_latic_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Leite desnatado', 100, 34, 5.0, 3.2, 0.1, 'Animal', tipo_latic_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Queijo minas frescal', 100, 264, 3.2, 17.4, 20.0, 'Animal', tipo_latic_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Iogurte natural', 100, 51, 1.9, 4.1, 3.0, 'Animal', tipo_latic_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Requeijão cremoso', 100, 257, 2.4, 9.6, 23.4, 'Animal', tipo_latic_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- VEGETAIS
    ('Brócolis cozido', 100, 35, 7.0, 2.4, 0.4, 'Vegetal', tipo_veg_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Couve refogada', 100, 90, 4.3, 2.9, 7.3, 'Vegetal', tipo_veg_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Espinafre cozido', 100, 24, 2.7, 2.6, 0.2, 'Vegetal', tipo_veg_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Tomate', 100, 15, 3.1, 1.1, 0.2, 'Vegetal', tipo_veg_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Cenoura cozida', 100, 30, 6.7, 0.8, 0.1, 'Vegetal', tipo_veg_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Batata doce cozida', 100, 86, 20.1, 0.6, 0.1, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Batata inglesa cozida', 100, 52, 11.9, 1.2, 0.0, 'Vegetal', tipo_carb_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- FRUTAS
    ('Banana prata', 100, 98, 26.0, 1.3, 0.1, 'Vegetal', tipo_fruta_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Maçã', 100, 63, 16.6, 0.2, 0.2, 'Vegetal', tipo_fruta_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Laranja', 100, 45, 11.5, 0.9, 0.1, 'Vegetal', tipo_fruta_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Mamão', 100, 45, 11.6, 0.5, 0.1, 'Vegetal', tipo_fruta_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Abacate', 100, 96, 6.0, 1.2, 8.4, 'Vegetal', tipo_fruta_id, 'Fonte: TACO 4ª edição', 'TACO'),
    
    -- GORDURAS E ÓLEOS
    ('Azeite de oliva', 100, 884, 0, 0, 100.0, 'Vegetal', tipo_lip_id, 'Extra virgem. Fonte: TACO 4ª edição', 'TACO'),
    ('Óleo de soja', 100, 884, 0, 0, 100.0, 'Vegetal', tipo_lip_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Manteiga', 100, 758, 0.1, 0.4, 82.4, 'Animal', tipo_lip_id, 'Fonte: TACO 4ª edição', 'TACO'),
    ('Margarina', 100, 720, 0, 0.2, 81.0, 'Vegetal', tipo_lip_id, 'Fonte: TACO 4ª edição', 'TACO')
    
    ON CONFLICT (nome) DO NOTHING;
    
    RAISE NOTICE 'Alimentos da TACO inseridos com sucesso!';
END $$;

-- ============================================
-- 3. VERIFICAR INSERÇÃO
-- ============================================

SELECT 
    COUNT(*) as total_alimentos,
    COUNT(DISTINCT tipo_id) as total_tipos
FROM public.alimentos 
WHERE autor = 'TACO';
