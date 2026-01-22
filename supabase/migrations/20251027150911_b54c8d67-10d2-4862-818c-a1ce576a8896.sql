-- Adicionar campo para armazenar exercícios nos treinos
ALTER TABLE treinos ADD COLUMN IF NOT EXISTS exercicios JSONB DEFAULT '[]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN treinos.exercicios IS 'Array de exercícios do treino com estrutura: [{nome, series, repeticoes, descanso, observacoes, ordem}]';