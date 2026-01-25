-- ============================================================================
-- SCHEMA: BLACKHOUSE-DOMAIN-ALUNO-COACH-004
-- ============================================================================
-- Domínio Aluno ↔ Coach com Aluno Canônico e Permissões Fortes
-- ============================================================================

-- ============================================================================
-- TABELA: users (auth canônico)
-- ============================================================================

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

COMMENT ON TABLE public.users IS 'Usuários do sistema (auth canônico)';
COMMENT ON COLUMN public.users.role IS 'Papel do usuário: aluno, coach, admin';

-- ============================================================================
-- TABELA: alunos (entidade de negócio)
-- ============================================================================
-- REGRA: Todo usuário com role=aluno DEVE possuir exatamente um registro em alunos
-- user_id é UNIQUE - um usuário só pode estar vinculado a um aluno
-- coach_id é obrigatório - aluno sempre pertence a um coach
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_user_id ON public.alunos(user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON public.alunos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);

COMMENT ON TABLE public.alunos IS 'Alunos do sistema (entidade de negócio)';
COMMENT ON COLUMN public.alunos.user_id IS 'ID do usuário vinculado (UNIQUE e NOT NULL - um usuário só pode estar vinculado a um aluno). Este campo é a única fonte de verdade para determinar vínculo.';
COMMENT ON COLUMN public.alunos.coach_id IS 'ID do coach responsável (obrigatório)';

-- ============================================================================
-- TABELA: conversas (1 aluno ↔ 1 coach)
-- ============================================================================
-- Agrupa mensagens entre um aluno e seu coach
-- UNIQUE(aluno_id, coach_id) garante uma única conversa por par aluno-coach
-- ============================================================================

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
CREATE INDEX IF NOT EXISTS idx_conversas_ultima_mensagem_em ON public.conversas(ultima_mensagem_em DESC);

COMMENT ON TABLE public.conversas IS 'Conversas entre aluno e coach (1 aluno ↔ 1 coach)';
COMMENT ON COLUMN public.conversas.aluno_id IS 'ID do aluno';
COMMENT ON COLUMN public.conversas.coach_id IS 'ID do coach';

-- ============================================================================
-- TABELA: mensagens
-- ============================================================================
-- Mensagens entre aluno e coach
-- remetente_id: quem enviou (users.id)
-- destinatario_id: quem recebeu (users.id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    destinatario_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lida BOOLEAN DEFAULT false,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON public.mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_destinatario_lida ON public.mensagens(destinatario_id, lida);
CREATE INDEX IF NOT EXISTS idx_mensagens_remetente ON public.mensagens(remetente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON public.mensagens(created_at DESC);

COMMENT ON TABLE public.mensagens IS 'Mensagens entre aluno e coach';
COMMENT ON COLUMN public.mensagens.conversa_id IS 'ID da conversa (agrupa mensagens entre aluno e coach)';
COMMENT ON COLUMN public.mensagens.remetente_id IS 'ID do usuário que enviou a mensagem (users.id)';
COMMENT ON COLUMN public.mensagens.destinatario_id IS 'ID do usuário que recebeu a mensagem (users.id)';

-- ============================================================================
-- FUNÇÃO: Criar conversa automaticamente se não existir
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_conversa(
    p_aluno_id UUID,
    p_coach_id UUID
) RETURNS UUID AS $$
DECLARE
    v_conversa_id UUID;
BEGIN
    -- Buscar conversa existente
    SELECT id INTO v_conversa_id
    FROM public.conversas
    WHERE aluno_id = p_aluno_id AND coach_id = p_coach_id
    LIMIT 1;
    
    -- Se não existir, criar
    IF v_conversa_id IS NULL THEN
        INSERT INTO public.conversas (aluno_id, coach_id)
        VALUES (p_aluno_id, p_coach_id)
        RETURNING id INTO v_conversa_id;
    END IF;
    
    RETURN v_conversa_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_or_create_conversa IS 'Retorna ou cria conversa entre aluno e coach';
