-- ============================================================================
-- SCHEMA CORRIGIDO - DOMAIN-RESOLUTION-ALUNO-COACH-003
-- ============================================================================
-- Usa linked_user_id (canônico) ao invés de user_id
-- Alinhado com VPS-NATIVE-ARCH-ALUNOS-COACH-001
-- ============================================================================

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('aluno', 'coach', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- alunos
-- IMPORTANTE: Usa linked_user_id (canônico) ao invés de user_id
-- linked_user_id é UNIQUE e NOT NULL - um usuário só pode estar vinculado a um aluno
CREATE TABLE IF NOT EXISTS public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id ON public.alunos(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON public.alunos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);

COMMENT ON TABLE public.alunos IS 'Alunos do sistema (entidade de negócio)';
COMMENT ON COLUMN public.alunos.linked_user_id IS 'ID do usuário vinculado (users.id). UNIQUE e NOT NULL - um usuário só pode estar vinculado a um aluno. Este campo é a única fonte de verdade para determinar vínculo.';
COMMENT ON COLUMN public.alunos.coach_id IS 'ID do coach responsável (obrigatório)';

-- conversas (tabela para agrupar mensagens entre aluno e coach)
CREATE TABLE IF NOT EXISTS public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(aluno_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_conversas_aluno_id ON public.conversas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_conversas_coach_id ON public.conversas(coach_id);

-- mensagens
-- Estrutura corrigida para usar conversa_id e remetente_id
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON public.mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON public.mensagens(remetente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_lida ON public.mensagens(lida);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON public.mensagens(created_at DESC);

COMMENT ON TABLE public.mensagens IS 'Mensagens entre aluno e coach';
COMMENT ON COLUMN public.mensagens.conversa_id IS 'ID da conversa (agrupa mensagens entre aluno e coach)';
COMMENT ON COLUMN public.mensagens.remetente_id IS 'ID do usuário que enviou a mensagem (users.id)';

-- ============================================================================
-- MIGRAÇÃO: Se a tabela alunos já existe com user_id, migrar para linked_user_id
-- ============================================================================

DO $$
BEGIN
  -- Verificar se coluna user_id existe e linked_user_id não existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alunos' 
    AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alunos' 
    AND column_name = 'linked_user_id'
  ) THEN
    -- Adicionar coluna linked_user_id
    ALTER TABLE public.alunos 
    ADD COLUMN linked_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    
    -- Copiar dados de user_id para linked_user_id
    UPDATE public.alunos 
    SET linked_user_id = user_id 
    WHERE user_id IS NOT NULL;
    
    -- Criar índice único em linked_user_id
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id 
    ON public.alunos(linked_user_id) 
    WHERE linked_user_id IS NOT NULL;
    
    -- Tornar linked_user_id NOT NULL (após popular dados)
    ALTER TABLE public.alunos 
    ALTER COLUMN linked_user_id SET NOT NULL;
    
    -- Remover coluna user_id (opcional - comentado por segurança)
    -- ALTER TABLE public.alunos DROP COLUMN user_id;
    
    RAISE NOTICE 'Migração concluída: user_id → linked_user_id';
  END IF;
END $$;
