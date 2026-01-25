-- Migração: Adicionar coluna idade na tabela alunos
-- Data: 13 de Janeiro de 2026
-- Objetivo: Alinhar schema canônico com estrutura do banco de dados

-- Adicionar coluna idade (nullable, tipo INTEGER)
-- Usar IF NOT EXISTS para tornar a migration idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alunos' 
        AND column_name = 'idade'
    ) THEN
        ALTER TABLE public.alunos 
        ADD COLUMN idade INTEGER;
        
        -- Adicionar comentário para documentação
        COMMENT ON COLUMN public.alunos.idade IS 'Idade do aluno em anos (inteiro, 0-150)';
    END IF;
END $$;

-- Verificar se a coluna foi criada
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alunos' 
        AND column_name = 'idade'
    ) THEN
        RAISE NOTICE 'Coluna idade adicionada com sucesso na tabela alunos';
    ELSE
        RAISE EXCEPTION 'Falha ao adicionar coluna idade na tabela alunos';
    END IF;
END $$;
