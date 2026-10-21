-- INSTRUÇÕES PARA APLICAR MIGRAÇÃO SIMPLES
-- Execute este arquivo SQL como superuser/owner no banco blackhouse_db

-- Verificar identidade do banco antes de aplicar
SELECT current_database(), current_schema(), current_user;

-- Aplicar migração simplificada (apenas coluna, sem FK)
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id ON public.alunos(linked_user_id);

-- Verificar que a coluna foi criada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'linked_user_id';
