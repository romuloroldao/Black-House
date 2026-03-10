-- =========================================================================
-- MIGRAÇÃO: Adicionar coluna user_id + Foreign Key em alunos
-- Banco: blackhouse_db
-- Schema: public
-- =========================================================================

-- Verificação de contexto
SELECT 
    current_database() AS database,
    current_schema() AS schema,
    current_user AS user,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port;

-- 1️⃣ Adicionar coluna user_id se não existir
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS user_id UUID NULL;

-- 2️⃣ Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_alunos_user_id 
ON public.alunos(user_id);

-- 3️⃣ Adicionar comentário
COMMENT ON COLUMN public.alunos.user_id IS 
'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. ON DELETE SET NULL.';

-- 4️⃣ Criar Foreign Key se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_alunos_user'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.alunos
        ADD CONSTRAINT fk_alunos_user
        FOREIGN KEY (user_id)
        REFERENCES app_auth.users(id)
        ON DELETE SET NULL;

        RAISE NOTICE 'Foreign key criada com sucesso.';
    ELSE
        RAISE NOTICE 'Foreign key já existe.';
    END IF;
END $$;

-- 5️⃣ Verificação final
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'user_id';

SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_schema AS foreign_schema,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'alunos'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6️⃣ Mensagem final
DO $$
BEGIN
    RAISE NOTICE 'Migração finalizada.';
    RAISE NOTICE 'Coluna user_id criada (nullable).';
    RAISE NOTICE 'Foreign Key aplicada com ON DELETE SET NULL.';
END $$;