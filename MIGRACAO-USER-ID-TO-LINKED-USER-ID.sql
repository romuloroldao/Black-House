-- ============================================================================
-- MIGRAÇÃO: user_id → linked_user_id
-- ============================================================================
-- DOMAIN-RESOLUTION-ALUNO-COACH-003
-- Migra tabela alunos de user_id para linked_user_id (canônico)
-- ============================================================================

DO $$
BEGIN
  -- Verificar se coluna user_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alunos' 
    AND column_name = 'user_id'
  ) THEN
    -- 1. Adicionar coluna linked_user_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'alunos' 
      AND column_name = 'linked_user_id'
    ) THEN
      ALTER TABLE public.alunos 
      ADD COLUMN linked_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Coluna linked_user_id criada';
    END IF;
    
    -- 2. Copiar dados de user_id para linked_user_id
    UPDATE public.alunos 
    SET linked_user_id = user_id 
    WHERE user_id IS NOT NULL 
    AND linked_user_id IS NULL;
    
    RAISE NOTICE 'Dados copiados de user_id para linked_user_id';
    
    -- 3. Criar índice único em linked_user_id
    DROP INDEX IF EXISTS idx_alunos_linked_user_id_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id_unique 
    ON public.alunos(linked_user_id) 
    WHERE linked_user_id IS NOT NULL;
    
    RAISE NOTICE 'Índice único criado em linked_user_id';
    
    -- 4. Tornar linked_user_id NOT NULL (após popular dados)
    -- Verificar se há alunos sem linked_user_id
    IF EXISTS (
      SELECT 1 FROM public.alunos 
      WHERE linked_user_id IS NULL
    ) THEN
      RAISE WARNING 'Existem alunos sem linked_user_id. Não é possível tornar NOT NULL.';
    ELSE
      ALTER TABLE public.alunos 
      ALTER COLUMN linked_user_id SET NOT NULL;
      
      RAISE NOTICE 'linked_user_id definido como NOT NULL';
    END IF;
    
    -- 5. Remover índice antigo de user_id (se existir)
    DROP INDEX IF EXISTS idx_alunos_user_id_unique;
    
    -- 6. Remover constraint unique de user_id (se existir)
    ALTER TABLE public.alunos 
    DROP CONSTRAINT IF EXISTS alunos_user_id_key;
    
    -- NOTA: Não removemos a coluna user_id automaticamente por segurança
    -- Execute manualmente após verificar que tudo está funcionando:
    -- ALTER TABLE public.alunos DROP COLUMN user_id;
    
    RAISE NOTICE 'Migração concluída: user_id → linked_user_id';
  ELSE
    RAISE NOTICE 'Coluna user_id não existe. Nada a fazer.';
  END IF;
END $$;
