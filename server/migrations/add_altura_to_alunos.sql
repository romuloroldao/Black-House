-- Migração: Adicionar coluna altura na tabela alunos
-- Data: 13 de Janeiro de 2026
-- Objetivo: Alinhar schema canônico com estrutura do banco de dados

-- Adicionar coluna altura (nullable, tipo NUMERIC)
-- Usar IF NOT EXISTS para tornar a migration idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alunos' 
        AND column_name = 'altura'
    ) THEN
        ALTER TABLE public.alunos 
        ADD COLUMN altura NUMERIC;
        
        -- Adicionar comentário para documentação
        COMMENT ON COLUMN public.alunos.altura IS 'Altura do aluno em centímetros (ex: 175 para 1.75m)';
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
        AND column_name = 'altura'
    ) THEN
        RAISE NOTICE 'Coluna altura adicionada com sucesso na tabela alunos';
    ELSE
        RAISE EXCEPTION 'Falha ao adicionar coluna altura na tabela alunos';
    END IF;
END $$;
