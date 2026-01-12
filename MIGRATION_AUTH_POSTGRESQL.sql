-- ============================================================================
-- SCRIPT DE MIGRAÇÃO: Supabase Auth → PostgreSQL Puro
-- ============================================================================
-- Este script recria todas as funções de autenticação do Supabase para uso
-- em um PostgreSQL standalone. Deve ser executado ANTES de criar as tabelas
-- que dependem dessas funções.
-- ============================================================================

-- ============================================================================
-- PARTE 1: CRIAR SCHEMA DE AUTENTICAÇÃO
-- ============================================================================

-- Criar schema auth (equivalente ao schema auth do Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================================
-- PARTE 2: EXTENSÕES NECESSÁRIAS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PARTE 3: TABELA DE USUÁRIOS (equivalente a auth.users do Supabase)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    email_confirmed_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    confirmation_token TEXT,
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token TEXT,
    recovery_sent_at TIMESTAMPTZ,
    email_change_token TEXT,
    email_change TEXT,
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'authenticated',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT,
    phone_confirmed_at TIMESTAMPTZ,
    phone_change TEXT,
    phone_change_token TEXT,
    phone_change_sent_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    reauthentication_token TEXT,
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON auth.users (created_at);

-- ============================================================================
-- PARTE 4: TABELA DE SESSÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    factor_id UUID,
    aal TEXT,
    not_after TIMESTAMPTZ,
    ip TEXT,
    user_agent TEXT,
    tag TEXT
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);

-- ============================================================================
-- PARTE 5: TABELA DE REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    parent TEXT,
    session_id UUID REFERENCES auth.sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens (token);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON auth.refresh_tokens (user_id);

-- ============================================================================
-- PARTE 6: VARIÁVEIS DE SESSÃO PARA CONTEXTO DE AUTENTICAÇÃO
-- ============================================================================

-- Função para definir o usuário atual na sessão
CREATE OR REPLACE FUNCTION auth.set_current_user(user_id UUID, user_email TEXT DEFAULT NULL, user_role TEXT DEFAULT 'authenticated')
RETURNS VOID AS $$
BEGIN
    -- Define variáveis de sessão que serão usadas pelas políticas RLS
    PERFORM set_config('auth.user_id', COALESCE(user_id::text, ''), TRUE);
    PERFORM set_config('auth.user_email', COALESCE(user_email, ''), TRUE);
    PERFORM set_config('auth.user_role', COALESCE(user_role, 'authenticated'), TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar contexto de autenticação
CREATE OR REPLACE FUNCTION auth.clear_current_user()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('auth.user_id', '', TRUE);
    PERFORM set_config('auth.user_email', '', TRUE);
    PERFORM set_config('auth.user_role', '', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 7: FUNÇÕES EQUIVALENTES ÀS DO SUPABASE
-- ============================================================================

-- auth.uid() - Retorna o UUID do usuário atual
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
DECLARE
    user_id_str TEXT;
BEGIN
    user_id_str := current_setting('auth.user_id', TRUE);
    IF user_id_str IS NULL OR user_id_str = '' THEN
        RETURN NULL;
    END IF;
    RETURN user_id_str::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- auth.email() - Retorna o email do usuário atual
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT AS $$
DECLARE
    email_str TEXT;
BEGIN
    email_str := current_setting('auth.user_email', TRUE);
    IF email_str IS NULL OR email_str = '' THEN
        RETURN NULL;
    END IF;
    RETURN email_str;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- auth.role() - Retorna o role do usuário atual
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT AS $$
DECLARE
    role_str TEXT;
BEGIN
    role_str := current_setting('auth.user_role', TRUE);
    IF role_str IS NULL OR role_str = '' THEN
        RETURN 'anon';
    END IF;
    RETURN role_str;
EXCEPTION WHEN OTHERS THEN
    RETURN 'anon';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- auth.jwt() - Retorna um JSON simulando o JWT do Supabase
-- Esta função é usada em várias políticas RLS do projeto
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB AS $$
DECLARE
    user_id_str TEXT;
    email_str TEXT;
    role_str TEXT;
BEGIN
    user_id_str := current_setting('auth.user_id', TRUE);
    email_str := current_setting('auth.user_email', TRUE);
    role_str := current_setting('auth.user_role', TRUE);
    
    RETURN jsonb_build_object(
        'sub', COALESCE(user_id_str, ''),
        'email', COALESCE(email_str, ''),
        'role', COALESCE(role_str, 'anon'),
        'aud', 'authenticated',
        'iat', EXTRACT(EPOCH FROM NOW())::INTEGER,
        'exp', EXTRACT(EPOCH FROM (NOW() + INTERVAL '1 hour'))::INTEGER
    );
EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PARTE 8: FUNÇÕES DE AUTENTICAÇÃO
-- ============================================================================

-- Função para criar hash de senha
CREATE OR REPLACE FUNCTION auth.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION auth.verify_password(password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hashed_password = crypt(password, hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar um novo usuário
CREATE OR REPLACE FUNCTION auth.create_user(
    p_email TEXT,
    p_password TEXT,
    p_email_confirm BOOLEAN DEFAULT FALSE,
    p_user_meta_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO auth.users (
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        LOWER(TRIM(p_email)),
        auth.hash_password(p_password),
        CASE WHEN p_email_confirm THEN NOW() ELSE NULL END,
        p_user_meta_data,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para autenticar usuário (login)
CREATE OR REPLACE FUNCTION auth.authenticate(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_user auth.users%ROWTYPE;
BEGIN
    -- Buscar usuário
    SELECT * INTO v_user
    FROM auth.users u
    WHERE u.email = LOWER(TRIM(p_email))
    AND u.deleted_at IS NULL;
    
    -- Usuário não encontrado
    IF v_user.id IS NULL THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            NULL::TEXT,
            FALSE,
            'Usuário não encontrado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar se está banido
    IF v_user.banned_until IS NOT NULL AND v_user.banned_until > NOW() THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            NULL::TEXT,
            FALSE,
            'Usuário temporariamente bloqueado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar senha
    IF NOT auth.verify_password(p_password, v_user.encrypted_password) THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            NULL::TEXT,
            FALSE,
            'Senha incorreta'::TEXT;
        RETURN;
    END IF;
    
    -- Atualizar último login
    UPDATE auth.users
    SET last_sign_in_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user.id;
    
    -- Retornar sucesso
    RETURN QUERY SELECT 
        v_user.id,
        v_user.email,
        TRUE,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar sessão
CREATE OR REPLACE FUNCTION auth.create_session(
    p_user_id UUID,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_session_id UUID;
BEGIN
    INSERT INTO auth.sessions (
        user_id,
        ip,
        user_agent,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_ip,
        p_user_agent,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_session_id;
    
    RETURN new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar refresh token
CREATE OR REPLACE FUNCTION auth.create_refresh_token(
    p_user_id UUID,
    p_session_id UUID
)
RETURNS TEXT AS $$
DECLARE
    new_token TEXT;
BEGIN
    new_token := encode(gen_random_bytes(32), 'base64');
    
    INSERT INTO auth.refresh_tokens (
        token,
        user_id,
        session_id,
        created_at,
        updated_at
    ) VALUES (
        new_token,
        p_user_id,
        p_session_id,
        NOW(),
        NOW()
    );
    
    RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para invalidar refresh token
CREATE OR REPLACE FUNCTION auth.revoke_refresh_token(p_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auth.refresh_tokens
    SET revoked = TRUE,
        updated_at = NOW()
    WHERE token = p_token;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar refresh token
CREATE OR REPLACE FUNCTION auth.validate_refresh_token(p_token TEXT)
RETURNS TABLE (
    user_id UUID,
    session_id UUID,
    is_valid BOOLEAN
) AS $$
DECLARE
    v_token auth.refresh_tokens%ROWTYPE;
BEGIN
    SELECT * INTO v_token
    FROM auth.refresh_tokens rt
    WHERE rt.token = p_token
    AND rt.revoked = FALSE;
    
    IF v_token.id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT v_token.user_id, v_token.session_id, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar senha
CREATE OR REPLACE FUNCTION auth.update_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auth.users
    SET encrypted_password = auth.hash_password(p_new_password),
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para deletar usuário (soft delete)
CREATE OR REPLACE FUNCTION auth.delete_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auth.users
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Invalidar todas as sessões
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    
    -- Revogar todos os refresh tokens
    UPDATE auth.refresh_tokens
    SET revoked = TRUE
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar usuário por email
CREATE OR REPLACE FUNCTION auth.get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_user_meta_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.email_confirmed_at,
        u.created_at,
        u.updated_at,
        u.last_sign_in_at,
        u.raw_user_meta_data
    FROM auth.users u
    WHERE u.email = LOWER(TRIM(p_email))
    AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para listar todos os usuários (admin)
CREATE OR REPLACE FUNCTION auth.admin_list_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_user_meta_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.email_confirmed_at,
        u.created_at,
        u.last_sign_in_at,
        u.raw_user_meta_data
    FROM auth.users u
    WHERE u.deleted_at IS NULL
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 9: FUNÇÕES ESPECÍFICAS DO PROJETO (usadas em RLS e queries)
-- ============================================================================

-- Função get_user_role (usada no projeto)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
BEGIN
    v_user_id := COALESCE(user_uuid, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT role INTO v_role
    FROM public.user_roles
    WHERE user_id = v_user_id;
    
    RETURN COALESCE(v_role, 'aluno');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função is_coach (usada no projeto)
CREATE OR REPLACE FUNCTION public.is_coach(user_uuid UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_user_role(user_uuid) = 'coach';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função get_aluno_id_by_email (usada no projeto)
CREATE OR REPLACE FUNCTION public.get_aluno_id_by_email(user_email TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_email TEXT;
    v_aluno_id UUID;
BEGIN
    v_email := COALESCE(user_email, auth.email());
    
    IF v_email IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT id INTO v_aluno_id
    FROM public.alunos
    WHERE email = v_email;
    
    RETURN v_aluno_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função get_coach_emails (usada no projeto)
CREATE OR REPLACE FUNCTION public.get_coach_emails()
RETURNS TABLE (email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.email
    FROM auth.users u
    INNER JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE ur.role = 'coach'
    AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Função get_users_with_roles (usada no projeto)
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.email,
        COALESCE(ur.role::TEXT, 'aluno') as role,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.deleted_at IS NULL
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PARTE 10: TRIGGER PARA CRIAR ROLE PADRÃO
-- ============================================================================

-- Função trigger para criar role de usuário automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (NEW.id, 'coach', NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger (será criado após a tabela user_roles existir)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PARTE 11: ENUM DO PROJETO
-- ============================================================================

-- Criar enum user_role se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('coach', 'aluno');
    END IF;
END$$;

-- ============================================================================
-- PARTE 12: TABELA USER_ROLES DO PROJETO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'coach',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);

-- Agora criar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PARTE 13: COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON SCHEMA auth IS 'Schema de autenticação compatível com Supabase Auth';
COMMENT ON TABLE auth.users IS 'Tabela de usuários do sistema';
COMMENT ON TABLE auth.sessions IS 'Sessões ativas dos usuários';
COMMENT ON TABLE auth.refresh_tokens IS 'Tokens de refresh para renovação de sessão';

COMMENT ON FUNCTION auth.uid() IS 'Retorna o UUID do usuário autenticado atual (equivalente a auth.uid() do Supabase)';
COMMENT ON FUNCTION auth.jwt() IS 'Retorna JSON simulando JWT do Supabase (usado em políticas RLS)';
COMMENT ON FUNCTION auth.email() IS 'Retorna o email do usuário autenticado atual';
COMMENT ON FUNCTION auth.role() IS 'Retorna o role do usuário autenticado atual';

-- ============================================================================
-- FIM DO SCRIPT DE MIGRAÇÃO
-- ============================================================================

-- INSTRUÇÕES DE USO:
-- 
-- 1. Execute este script no seu PostgreSQL antes de criar as tabelas do projeto
--
-- 2. No seu backend (Node.js/Express), antes de cada query, defina o contexto:
--    
--    const setAuthContext = async (pool, userId, userEmail, userRole) => {
--      await pool.query(`SELECT auth.set_current_user($1, $2, $3)`, [userId, userEmail, userRole]);
--    };
--
-- 3. Após o processamento, limpe o contexto:
--    
--    const clearAuthContext = async (pool) => {
--      await pool.query(`SELECT auth.clear_current_user()`);
--    };
--
-- 4. Para criar um novo usuário:
--    
--    SELECT auth.create_user('email@exemplo.com', 'senha123', true);
--
-- 5. Para autenticar:
--    
--    SELECT * FROM auth.authenticate('email@exemplo.com', 'senha123');
--
