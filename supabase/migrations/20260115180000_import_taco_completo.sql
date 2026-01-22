-- Importação completa de dados TACO (Tabela Brasileira de Composição de Alimentos)
-- Baseado na TACO 4ª edição e dados disponíveis
-- Esta migração adiciona alimentos faltantes por tipo (carboidratos, frutas, vegetais, laticínios, lipídios)

-- ============================================================================
-- CARBOIDRATOS
-- ============================================================================
INSERT INTO alimentos (nome, quantidade_referencia_g, kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia, origem_ptn, tipo_id, info_adicional)
SELECT nome, 100, kcal, ptn, cho, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª Edição'
FROM (
  VALUES
    -- Cereais e derivados
    ('Arroz, integral, cozido', 100.00, 124.00, 2.58, 25.80, 1.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Arroz, integral, cru', 100.00, 359.84, 7.32, 77.54, 1.90, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Arroz, tipo 1, cozido', 100.00, 128.26, 2.50, 28.06, 0.22, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Arroz, tipo 1, cru', 100.00, 357.74, 7.17, 78.84, 0.30, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Arroz, tipo 2, cozido', 100.00, 130.13, 2.31, 28.19, 0.22, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Arroz, tipo 2, cru', 100.00, 358.18, 6.96, 78.88, 0.35, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    
    -- Tubérculos
    ('Batata, doce, cozida', 100.00, 77.45, 0.64, 18.43, 0.07, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Batata, doce, crua', 100.00, 118.39, 1.30, 28.15, 0.06, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Batata, inglesa, cozida', 100.00, 52.35, 1.16, 11.94, 0.01, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Batata, inglesa, crua', 100.00, 64.37, 1.77, 14.69, 0.05, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Batata, inglesa, frita', 100.00, 267.12, 5.04, 35.57, 12.63, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Batata, inglesa, purê', 100.00, 73.27, 1.32, 13.66, 1.70, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Mandioca, cozida', 100.00, 125.31, 0.56, 30.09, 0.25, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Mandioca, crua', 100.00, 151.37, 1.36, 38.06, 0.30, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Mandioca, farinha, crua', 100.00, 361.81, 1.62, 87.90, 0.30, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Mandioca, frita', 100.00, 300.11, 1.36, 50.28, 11.20, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Inhame, cru', 100.00, 96.75, 2.29, 23.23, 0.18, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    
    -- Pães e bolos
    ('Pão, de forma, integral', 100.00, 253.19, 9.40, 44.31, 3.70, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Pão, de forma, tipo bisnaga', 100.00, 252.58, 8.40, 49.20, 2.70, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Pão, francês', 100.00, 299.82, 8.00, 58.65, 3.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Pão, doce, folhado', 100.00, 362.48, 6.20, 45.94, 17.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Pão, glúten, sem sal', 100.00, 252.58, 8.40, 49.20, 2.70, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    
    -- Massas
    ('Macarrão, instantâneo', 100.00, 435.77, 8.80, 61.85, 17.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Macarrão, trigo, cru', 100.00, 370.95, 10.32, 77.35, 1.51, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Macarrão, trigo, cozido', 100.00, 137.51, 4.20, 25.01, 0.65, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Lasanha, massas, bolonhesa', 100.00, 164.31, 7.40, 18.74, 6.02, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    
    -- Leguminosas
    ('Feijão, carioca, cozido', 100.00, 76.66, 4.80, 13.63, 0.54, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, carioca, cru', 100.00, 329.60, 20.09, 61.24, 1.25, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, preto, cozido', 100.00, 77.04, 4.47, 14.01, 0.54, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, preto, cru', 100.00, 343.17, 21.34, 62.35, 1.42, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, branco, cozido', 100.00, 62.25, 4.53, 10.22, 0.45, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, branco, cru', 100.00, 332.54, 23.18, 60.03, 1.36, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, rajado, cozido', 100.00, 84.56, 5.09, 15.22, 0.38, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Feijão, rajado, cru', 100.00, 323.85, 20.35, 58.09, 1.26, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Grão-de-bico, cru', 100.00, 355.06, 21.22, 57.86, 5.35, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Lentilha, cozida', 100.00, 72.71, 6.32, 12.74, 0.44, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Lentilha, crua', 100.00, 297.35, 23.18, 50.54, 1.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Soja, cozida', 100.00, 151.26, 11.98, 5.24, 6.59, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Soja, crua', 100.00, 395.20, 36.01, 23.43, 19.46, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    
    -- Outros carboidratos
    ('Aveia, flocos, crua', 100.00, 393.84, 13.92, 66.55, 8.50, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Tapioca, de goma', 100.00, 335.18, 0.53, 81.05, 0.10, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Milho, amarelo, cozido', 100.00, 98.34, 3.34, 17.13, 2.42, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Milho, amarelo, cru', 100.00, 353.13, 9.30, 70.30, 4.68, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Milho, verde, cozido', 100.00, 98.11, 3.17, 17.07, 2.36, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Milho, verde, cru', 100.00, 137.77, 3.16, 28.58, 0.64, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos')),
    ('Polenta, pré-cozida', 100.00, 259.53, 2.38, 55.35, 2.31, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Carboidratos'))
) AS t(nome, quantidade_referencia_g, kcal, ptn, cho, lip, origem_ptn, tipo_id)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- FRUTAS
-- ============================================================================
INSERT INTO alimentos (nome, quantidade_referencia_g, kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia, origem_ptn, tipo_id, info_adicional)
SELECT nome, 100, kcal, ptn, cho, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª Edição'
FROM (
  VALUES
    ('Abacate, cru', 100.00, 96.15, 1.20, 6.00, 8.40, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Abacaxi, cru', 100.00, 48.26, 0.89, 12.34, 0.12, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Acerola, crua', 100.00, 33.36, 0.90, 8.00, 0.19, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Ameixa, calda, enlatada', 100.00, 182.87, 0.41, 46.85, 0.10, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Banana, maçã, crua', 100.00, 87.50, 1.83, 22.34, 0.07, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Banana, nanica, crua', 100.00, 91.59, 1.40, 23.84, 0.11, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Banana, ouro, crua', 100.00, 112.35, 1.50, 28.72, 0.19, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Banana, prata, crua', 100.00, 98.36, 1.27, 26.01, 0.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Caju, cru', 100.00, 43.13, 1.04, 10.35, 0.30, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Goiaba, branca, com casca, crua', 100.00, 51.68, 0.90, 12.42, 0.45, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Goiaba, vermelha, com casca, crua', 100.00, 54.16, 1.08, 13.01, 0.42, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Laranja, baía, crua', 100.00, 45.41, 0.90, 11.48, 0.12, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Laranja, lima, crua', 100.00, 45.63, 1.06, 11.47, 0.13, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Laranja, pêra, crua', 100.00, 36.94, 0.98, 9.15, 0.10, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Limão, cravo, suco', 100.00, 21.51, 0.58, 6.48, 0.08, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Limão, galego, suco', 100.00, 21.51, 0.58, 6.48, 0.08, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Maçã, argentina, com casca, crua', 100.00, 63.14, 0.27, 16.58, 0.17, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Maçã, fuji, com casca, crua', 100.00, 56.13, 0.30, 15.17, 0.16, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Mamão, formosa, cru', 100.00, 45.27, 0.82, 11.55, 0.11, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Mamão, papaia, cru', 100.00, 40.16, 0.52, 10.42, 0.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Manga, palmer, crua', 100.00, 51.99, 0.44, 12.80, 0.18, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Manga, tommy, crua', 100.00, 51.63, 0.52, 12.72, 0.14, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Melancia, crua', 100.00, 33.16, 0.88, 8.13, 0.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Melão, cru', 100.00, 29.38, 0.68, 7.46, 0.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Morango, cru', 100.00, 30.10, 0.89, 6.78, 0.30, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Tangerina, poncã, crua', 100.00, 37.84, 0.86, 9.57, 0.07, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Uva, itália, crua', 100.00, 52.98, 0.72, 13.57, 0.16, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas')),
    ('Uva, rubi, crua', 100.00, 48.92, 0.64, 12.68, 0.16, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Frutas'))
) AS t(nome, quantidade_referencia_g, kcal, ptn, cho, lip, origem_ptn, tipo_id)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- VEGETAIS
-- ============================================================================
INSERT INTO alimentos (nome, quantidade_referencia_g, kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia, origem_ptn, tipo_id, info_adicional)
SELECT nome, 100, kcal, ptn, cho, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª Edição'
FROM (
  VALUES
    ('Abóbora, cabotiá, cozida', 100.00, 48.22, 1.43, 10.84, 0.81, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Abóbora, moranga, crua', 100.00, 19.31, 0.93, 4.40, 0.07, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Abóbora, pescoço, crua', 100.00, 23.52, 0.96, 5.40, 0.04, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Abobrinha, italiana, cozida', 100.00, 15.09, 1.11, 2.97, 0.22, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Abobrinha, italiana, crua', 100.00, 19.15, 1.06, 4.26, 0.19, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Abobrinha, italiana, refogada', 100.00, 24.42, 1.35, 5.20, 0.45, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Alface, americana, crua', 100.00, 9.37, 0.58, 1.67, 0.13, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Alface, crespa, crua', 100.00, 10.96, 1.35, 1.67, 0.13, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Alface, lisa, crua', 100.00, 10.61, 1.34, 1.68, 0.13, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Almeirão, cru', 100.00, 17.94, 1.77, 3.41, 0.18, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Beterraba, cozida', 100.00, 32.40, 1.34, 7.23, 0.08, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Beterraba, crua', 100.00, 48.77, 1.86, 11.07, 0.09, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Brócolis, cozido', 100.00, 25.16, 2.14, 4.40, 0.28, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Brócolis, cru', 100.00, 25.48, 2.98, 4.04, 0.33, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Cenoura, cozida', 100.00, 29.80, 0.77, 6.68, 0.14, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Cenoura, crua', 100.00, 34.68, 1.31, 7.67, 0.18, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Chicória, crua', 100.00, 14.04, 1.06, 2.88, 0.10, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Couve, manteiga, refogada', 100.00, 90.19, 2.63, 8.59, 5.51, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Couve-flor, crua', 100.00, 19.11, 1.91, 4.52, 0.21, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Couve-flor, cozida', 100.00, 18.98, 1.25, 3.88, 0.21, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Espinafre, cru', 100.00, 16.27, 2.70, 2.60, 0.26, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Espinafre, refogado', 100.00, 67.31, 2.68, 4.19, 4.73, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Pepino, cru', 100.00, 9.55, 0.86, 2.00, 0.12, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Pimentão, verde, cru', 100.00, 20.90, 1.05, 4.58, 0.17, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Pimentão, vermelho, cru', 100.00, 23.31, 1.03, 5.46, 0.15, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Rúcula, crua', 100.00, 13.04, 1.77, 2.17, 0.10, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Tomate, cru', 100.00, 15.13, 1.10, 3.14, 0.17, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Tomate, molho industrializado', 100.00, 37.72, 1.41, 7.71, 0.28, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais')),
    ('Tomate, extrato', 100.00, 61.06, 2.63, 15.10, 0.18, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Vegetais'))
) AS t(nome, quantidade_referencia_g, kcal, ptn, cho, lip, origem_ptn, tipo_id)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- LATICÍNIOS
-- ============================================================================
INSERT INTO alimentos (nome, quantidade_referencia_g, kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia, origem_ptn, tipo_id, info_adicional)
SELECT nome, 100, kcal, ptn, cho, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª Edição'
FROM (
  VALUES
    ('Leite, condensado', 100.00, 313.26, 7.38, 56.85, 6.95, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Leite, de cabra', 100.00, 66.70, 3.04, 4.81, 4.03, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Leite, de vaca, achocolatado', 100.00, 82.99, 2.13, 14.19, 2.18, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Leite, de vaca, desnatado, pasteurizado', 100.00, 33.86, 2.95, 4.58, 0.19, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Leite, de vaca, integral, pasteurizado', 100.00, 59.58, 3.04, 4.70, 3.04, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Leite, em pó, integral', 100.00, 496.65, 25.40, 39.20, 26.90, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, cottage', 100.00, 98.35, 12.64, 2.75, 4.22, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, minas, frescal', 100.00, 243.76, 17.41, 3.24, 18.46, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, minas, meia cura', 100.00, 320.85, 21.20, 3.57, 24.60, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, mozarela', 100.00, 329.84, 22.63, 3.05, 25.16, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, parmesão, ralado', 100.00, 452.83, 33.85, 1.69, 33.50, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, petit suisse, morango', 100.00, 120.73, 5.79, 18.71, 2.81, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, prato', 100.00, 359.65, 22.66, 2.67, 28.95, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Queijo, ricota', 100.00, 140.41, 12.57, 3.79, 8.14, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Requeijão, cremoso', 100.00, 256.76, 9.63, 2.43, 23.43, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Iogurte, desnatado, natural', 100.00, 41.43, 3.80, 5.81, 0.30, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Iogurte, desnatado, pêssego', 100.00, 69.22, 2.89, 12.01, 0.29, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Iogurte, integral, natural', 100.00, 51.44, 4.13, 1.89, 2.82, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios')),
    ('Iogurte, integral, morango', 100.00, 71.24, 2.68, 12.92, 1.48, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Laticínios'))
) AS t(nome, quantidade_referencia_g, kcal, ptn, cho, lip, origem_ptn, tipo_id)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- LIPÍDEOS
-- ============================================================================
INSERT INTO alimentos (nome, quantidade_referencia_g, kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia, origem_ptn, tipo_id, info_adicional)
SELECT nome, 100, kcal, ptn, cho, lip, origem_ptn, tipo_id, 'Fonte: TACO 4ª Edição'
FROM (
  VALUES
    ('Azeite, de dendê', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Azeite, de oliva, extra virgem', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Manteiga, com sal', 100.00, 726.36, 0.43, 0.08, 82.42, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Manteiga, sem sal', 100.00, 758.05, 0.37, 0.00, 84.95, 'Animal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Margarina, com sal, light, 40% de lipídeos', 100.00, 358.50, 0.14, 0.77, 40.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Margarina, com sal, tradicional', 100.00, 723.97, 0.17, 0.79, 82.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Óleo, de canola', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Óleo, de girassol', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Óleo, de milho', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Óleo, de soja', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos')),
    ('Gordura, vegetal, hidrogenada', 100.00, 884.00, 0.00, 0.00, 100.00, 'Vegetal', (SELECT id FROM tipos_alimentos WHERE nome_tipo = 'Lipídeos'))
) AS t(nome, quantidade_referencia_g, kcal, ptn, cho, lip, origem_ptn, tipo_id)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- RESUMO DA IMPORTAÇÃO
-- ============================================================================
-- Total estimado de alimentos importados:
-- - Proteínas (animais): ~101 (já existente na migração anterior)
-- - Carboidratos: ~52 (esta migração)
-- - Frutas: ~28 (esta migração)
-- - Vegetais: ~29 (esta migração)
-- - Laticínios: ~19 (esta migração)
-- - Lipídeos: ~11 (esta migração)
-- TOTAL: ~240 alimentos da TACO
