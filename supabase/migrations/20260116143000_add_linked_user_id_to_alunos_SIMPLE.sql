-- SCHEMA-02: Adicionar campo linked_user_id à tabela alunos (VERSÃO SIMPLIFICADA)
-- Esta migração adiciona apenas a coluna linked_user_id sem outras dependências
-- Pode ser executada de forma idempotente

-- Adicionar coluna linked_user_id se não existir
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL;

-- Criar índice para performance (se a coluna existir)
CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id ON public.alunos(linked_user_id);

-- Comentar a coluna para documentação
COMMENT ON COLUMN public.alunos.linked_user_id IS 'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.';
