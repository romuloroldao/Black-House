-- Update existing itens_dieta with standardized meal names
UPDATE itens_dieta 
SET refeicao = CASE 
  WHEN LOWER(refeicao) IN ('refeição 1', 'refeicao 1', 'ref 1') THEN 'Café da Manhã'
  WHEN LOWER(refeicao) IN ('refeição 2', 'refeicao 2', 'ref 2') THEN 'Lanche da Manhã'
  WHEN LOWER(refeicao) IN ('refeição 3', 'refeicao 3', 'ref 3') THEN 'Almoço'
  WHEN LOWER(refeicao) IN ('refeição 4', 'refeicao 4', 'ref 4') THEN 'Lanche da Tarde'
  WHEN LOWER(refeicao) IN ('refeição 5', 'refeicao 5', 'ref 5') THEN 'Jantar'
  WHEN LOWER(refeicao) IN ('refeição 6', 'refeicao 6', 'ref 6') THEN 'Ceia'
  ELSE refeicao
END
WHERE LOWER(refeicao) LIKE 'refeição%' OR LOWER(refeicao) LIKE 'refeicao%' OR LOWER(refeicao) LIKE 'ref %';