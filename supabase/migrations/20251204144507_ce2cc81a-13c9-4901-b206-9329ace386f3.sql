-- Add new food types
INSERT INTO tipos_alimentos (nome_tipo) VALUES 
  ('Frutas'),
  ('Vegetais'),
  ('Laticínios')
ON CONFLICT (nome_tipo) DO NOTHING;