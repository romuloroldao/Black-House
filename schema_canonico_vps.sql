-- ============================================================================
-- SCHEMA CANÔNICO VPS - VPS-BACKEND-CANONICAL-ARCH-001
-- ============================================================================
-- PostgreSQL como única fonte de dados
-- Sem dependências externas (Supabase, PostgREST, Storage)
-- ============================================================================

-- ============================================================================
-- EXTENSÕES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================================
-- TABELA: users (auth canônico)
-- ============================================================================
-- Substitui app_auth.users - simplificado e canônico
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('coach', 'aluno', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

COMMENT ON TABLE public.users IS 'Usuários do sistema (auth canônico)';
COMMENT ON COLUMN public.users.role IS 'Papel do usuário: coach, aluno, admin';

-- ============================================================================
-- TABELA: alunos (entidade de negócio)
-- ============================================================================
-- linked_user_id é UNIQUE e NOT NULL - um usuário só pode estar vinculado a um aluno
-- coach_id é obrigatório - aluno sempre pertence a um coach
-- DOMAIN-RESOLUTION-ALUNO-COACH-003: Usa linked_user_id (canônico)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linked_user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id_unique ON public.alunos(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON public.alunos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);

COMMENT ON TABLE public.alunos IS 'Alunos do sistema (entidade de negócio)';
COMMENT ON COLUMN public.alunos.linked_user_id IS 'ID do usuário vinculado (UNIQUE e NOT NULL - um usuário só pode estar vinculado a um aluno). Este campo é a única fonte de verdade para determinar vínculo.';
COMMENT ON COLUMN public.alunos.coach_id IS 'ID do coach responsável (obrigatório)';

-- ============================================================================
-- TABELA: mensagens (aluno ↔ coach)
-- ============================================================================
-- Mensagens entre aluno e seu coach
-- sender_role determina quem enviou (aluno ou coach)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('aluno', 'coach')),
    sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_aluno_id ON public.mensagens(aluno_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_sender_user_id ON public.mensagens(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON public.mensagens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_lida ON public.mensagens(lida);

COMMENT ON TABLE public.mensagens IS 'Mensagens entre aluno e coach';
COMMENT ON COLUMN public.mensagens.sender_role IS 'Papel do remetente: aluno ou coach';
COMMENT ON COLUMN public.mensagens.sender_user_id IS 'ID do usuário que enviou a mensagem';

-- ============================================================================
-- TABELA: uploads (avatars e arquivos)
-- ============================================================================
-- Uploads controlados via filesystem
-- owner_user_id sempre é o usuário que fez upload
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('avatar', 'document')),
    path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_owner_user_id ON public.uploads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_type ON public.uploads(type);

COMMENT ON TABLE public.uploads IS 'Uploads de arquivos (avatars e documentos)';
COMMENT ON COLUMN public.uploads.owner_user_id IS 'ID do usuário que fez upload (sempre o dono)';
COMMENT ON COLUMN public.uploads.path IS 'Caminho relativo no filesystem (/uploads/avatars/{user_id}.png)';

-- ============================================================================
-- FUNÇÕES DE AUTENTICAÇÃO
-- ============================================================================

-- Função para hash de senha
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hash TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar usuário
CREATE OR REPLACE FUNCTION public.create_user(p_email TEXT, p_password TEXT, p_role TEXT DEFAULT 'aluno') 
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO public.users (email, password_hash, role)
    VALUES (LOWER(p_email), public.hash_password(p_password), p_role)
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para login
CREATE OR REPLACE FUNCTION public.login(p_email TEXT, p_password TEXT) 
RETURNS TABLE(user_id UUID, role TEXT) AS $$
DECLARE
    v_user public.users%ROWTYPE;
BEGIN
    SELECT * INTO v_user 
    FROM public.users 
    WHERE email = LOWER(p_email);
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;
    
    IF NOT public.verify_password(p_password, v_user.password_hash) THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;
    
    RETURN QUERY SELECT v_user.id, v_user.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON public.alunos 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
