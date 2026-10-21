-- SCHEMA-02: Adicionar campo linked_user_id à tabela alunos
-- FONTE DE VERDADE: vínculo entre aluno importado e credencial de usuário
-- linked_user_id NULL = não vinculado, linked_user_id NOT NULL = vinculado
-- Este campo elimina ambiguidade e permite re-vinculação explícita

-- Adicionar coluna linked_user_id se não existir
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL;

-- Criar foreign key para app_auth.users
-- NOTA: ON DELETE SET NULL para permitir desvínculo quando usuário é deletado
ALTER TABLE public.alunos
DROP CONSTRAINT IF EXISTS alunos_linked_user_id_fkey;

ALTER TABLE public.alunos
ADD CONSTRAINT alunos_linked_user_id_fkey
FOREIGN KEY (linked_user_id)
REFERENCES app_auth.users(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Criar índice para performance em buscas de vínculo
CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id ON public.alunos(linked_user_id);

-- Comentar a coluna para documentação
COMMENT ON COLUMN public.alunos.linked_user_id IS 'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.';

-- Atualizar registros existentes: inferir linked_user_id de alunos que têm email
-- correspondente a um usuário existente (migração única)
UPDATE public.alunos a
SET linked_user_id = u.id
FROM app_auth.users u
WHERE a.email IS NOT NULL 
  AND a.email != ''
  AND a.email = u.email
  AND a.linked_user_id IS NULL;
