-- ============================================================================
-- Fase 1 — Schema app_auth (substitui auth.users do Supabase)
-- Executar no Postgres da VPS ANTES de apontar a API.
-- Requer: CREATE EXTENSION pgcrypto (ou uuid-ossp + pgcrypto).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS app_auth;

CREATE TABLE IF NOT EXISTS app_auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    email_confirmed_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_auth_users_email ON app_auth.users (email);

CREATE TABLE IF NOT EXISTS app_auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_user ON app_auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_token ON app_auth.sessions (token);
CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_expires ON app_auth.sessions (expires_at);

-- Hash bcrypt via pgcrypto
CREATE OR REPLACE FUNCTION app_auth.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.create_user(
    p_email TEXT,
    p_password TEXT,
    p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
        RAISE EXCEPTION 'Email obrigatório';
    END IF;
    IF p_password IS NULL OR length(p_password) < 8 THEN
        RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres';
    END IF;

    INSERT INTO app_auth.users (email, password_hash, email_confirmed_at, raw_user_meta_data)
    VALUES (
        LOWER(trim(p_email)),
        app_auth.hash_password(p_password),
        NOW(),
        COALESCE(p_meta, '{}'::jsonb)
    )
    RETURNING id INTO new_user_id;

    RETURN new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.login(
    p_email TEXT,
    p_password TEXT
)
RETURNS TABLE(user_id UUID, session_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
DECLARE
    v_user_id UUID;
    v_password_hash TEXT;
    v_deleted TIMESTAMPTZ;
    v_token TEXT;
BEGIN
    SELECT id, password_hash, deleted_at
      INTO v_user_id, v_password_hash, v_deleted
    FROM app_auth.users
    WHERE email = LOWER(trim(p_email));

    IF v_user_id IS NULL OR v_deleted IS NOT NULL THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;

    IF NOT app_auth.verify_password(p_password, v_password_hash) THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;

    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO app_auth.sessions (user_id, token, expires_at)
    VALUES (v_user_id, v_token, NOW() + INTERVAL '7 days');

    UPDATE app_auth.users
    SET last_sign_in_at = NOW(), updated_at = NOW()
    WHERE id = v_user_id;

    RETURN QUERY SELECT v_user_id, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.validate_session(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT s.user_id INTO v_user_id
    FROM app_auth.sessions s
    JOIN app_auth.users u ON u.id = s.user_id
    WHERE s.token = p_token
      AND s.expires_at > NOW()
      AND u.deleted_at IS NULL;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
BEGIN
    DELETE FROM app_auth.sessions WHERE token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION app_auth.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_auth, public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app_auth.sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Roles (só cria se ainda não existir no banco)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('coach', 'aluno');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_coach(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'coach'
    );
$$;

COMMENT ON SCHEMA app_auth IS 'Auth local Black House — caminho B (VPS + API)';
