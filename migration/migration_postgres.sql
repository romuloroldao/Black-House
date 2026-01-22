-- =============================================
-- MIGRAÇÃO PARA POSTGRESQL PURO
-- =============================================

-- Criar schema para usuários
CREATE SCHEMA IF NOT EXISTS app_auth;

-- Tabela de usuários (substituindo auth.users do Supabase)
CREATE TABLE app_auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    email_confirmed_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- Tabela de sessões
CREATE TABLE app_auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sessions_user_id ON app_auth.sessions(user_id);
CREATE INDEX idx_sessions_token ON app_auth.sessions(token);
CREATE INDEX idx_sessions_expires ON app_auth.sessions(expires_at);

-- Função para hash de senha
CREATE OR REPLACE FUNCTION app_auth.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION app_auth.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar usuário
CREATE OR REPLACE FUNCTION app_auth.create_user(
    p_email TEXT,
    p_password TEXT
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO app_auth.users (email, password_hash)
    VALUES (LOWER(p_email), app_auth.hash_password(p_password))
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para login
CREATE OR REPLACE FUNCTION app_auth.login(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE(user_id UUID, session_token TEXT) AS $$
DECLARE
    v_user_id UUID;
    v_password_hash TEXT;
    v_token TEXT;
BEGIN
    SELECT id, password_hash INTO v_user_id, v_password_hash
    FROM app_auth.users
    WHERE email = LOWER(p_email);
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;
    
    IF NOT app_auth.verify_password(p_password, v_password_hash) THEN
        RAISE EXCEPTION 'Senha incorreta';
    END IF;
    
    -- Gerar token de sessão
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Criar sessão (expira em 7 dias)
    INSERT INTO app_auth.sessions (user_id, token, expires_at)
    VALUES (v_user_id, v_token, NOW() + INTERVAL '7 days');
    
    -- Atualizar último login
    UPDATE app_auth.users SET last_sign_in_at = NOW() WHERE id = v_user_id;
    
    RETURN QUERY SELECT v_user_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar sessão
CREATE OR REPLACE FUNCTION app_auth.validate_session(p_token TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM app_auth.sessions
    WHERE token = p_token AND expires_at > NOW();
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para logout
CREATE OR REPLACE FUNCTION app_auth.logout(p_token TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM app_auth.sessions WHERE token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar sessões expiradas (rodar periodicamente)
CREATE OR REPLACE FUNCTION app_auth.cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app_auth.sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TABELAS PÚBLICAS (adaptar do schema.sql exportado)
-- =============================================

-- Enum para roles
CREATE TYPE user_role AS ENUM ('coach', 'aluno');

-- Tabela user_roles (referenciando app_auth.users)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Trigger para criar role ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'coach');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT ON app_auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função auxiliar para obter user_id da sessão atual
-- (será usada pela API para verificar permissões)
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS user_role AS $$
    SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_coach(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = p_user_id AND role = 'coach'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- DEMAIS TABELAS (importar do schema_public.sql)
-- Remova referências a auth.users e substitua por app_auth.users
-- =============================================

-- NOTA: Após executar este script, você precisará:
-- 1. Importar o schema_public.sql (exportado do Supabase)
-- 2. Substituir todas as referências de auth.users para app_auth.users
-- 3. Ajustar foreign keys conforme necessário
