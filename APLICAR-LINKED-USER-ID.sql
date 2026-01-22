-- ============================================================================
-- MIGRAÇÃO: Adicionar coluna linked_user_id à tabela alunos
-- ============================================================================
-- Este script adiciona a coluna linked_user_id necessária para vínculo
-- aluno ↔ usuário.
-- 
-- PRÉ-REQUISITOS:
-- - Executar como superuser ou owner da tabela alunos
-- - Banco: blackhouse_db
-- - Schema: public
-- 
-- INSTRUÇÕES:
-- 1. Conectar ao banco como postgres ou owner:
--    psql -h localhost -p 5432 -U postgres -d blackhouse_db
--
-- 2. Executar este arquivo:
--    \i /root/APLICAR-LINKED-USER-ID.sql
--
-- Ou executar diretamente:
--    psql -h localhost -p 5432 -U postgres -d blackhouse_db -f /root/APLICAR-LINKED-USER-ID.sql
-- ============================================================================

-- Verificar identidade do banco antes de aplicar
SELECT 
    current_database() AS database,
    current_schema() AS schema,
    current_user AS user,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port;

-- Verificar se coluna já existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'alunos' 
          AND column_name = 'linked_user_id'
    ) THEN
        RAISE NOTICE 'Coluna linked_user_id já existe. Nada a fazer.';
    ELSE
        RAISE NOTICE 'Criando coluna linked_user_id...';
    END IF;
END $$;

-- Adicionar coluna linked_user_id se não existir
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL;

-- Criar índice para performance em buscas de vínculo
CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id 
ON public.alunos(linked_user_id);

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.alunos.linked_user_id IS 
'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.';

-- Verificar que a coluna foi criada
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'linked_user_id';

-- Verificar que o índice foi criado
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'alunos'
  AND indexname = 'idx_alunos_linked_user_id';

-- Mensagem de sucesso
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'alunos' 
          AND column_name = 'linked_user_id'
    ) THEN
        RAISE NOTICE '✅ Migração aplicada com sucesso!';
        RAISE NOTICE '✅ Coluna linked_user_id criada e pronta para uso.';
        RAISE NOTICE '✅ Reiniciar backend para revalidar schema (opcional - cache invalida após 60s).';
    ELSE
        RAISE WARNING '⚠️  Coluna linked_user_id não foi criada. Verificar erros acima.';
    END IF;
END $$;
