--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Ubuntu 15.13-1.pgdg20.04+1)
-- Dumped by pg_dump version 15.13 (Ubuntu 15.13-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_auth;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'coach',
    'aluno'
);


--
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.cleanup_expired_sessions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app_auth.sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: create_user(text, text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.create_user(p_email text, p_password text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO app_auth.users (email, password_hash)
    VALUES (LOWER(p_email), app_auth.hash_password(p_password))
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$;


--
-- Name: hash_password(text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.hash_password(password text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$;


--
-- Name: login(text, text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.login(p_email text, p_password text) RETURNS TABLE(user_id uuid, session_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: logout(text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.logout(p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM app_auth.sessions WHERE token = p_token;
END;
$$;


--
-- Name: validate_session(text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.validate_session(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM app_auth.sessions
    WHERE token = p_token AND expires_at > NOW();
    
    RETURN v_user_id;
END;
$$;


--
-- Name: verify_password(text, text); Type: FUNCTION; Schema: app_auth; Owner: -
--

CREATE FUNCTION app_auth.verify_password(password text, hash text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(p_user_id uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'coach');
    RETURN NEW;
END;
$$;


--
-- Name: is_coach(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_coach(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = p_user_id AND role = 'coach'
    );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: sessions; Type: TABLE; Schema: app_auth; Owner: -
--

CREATE TABLE app_auth.sessions (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: app_auth; Owner: -
--

CREATE TABLE app_auth.users (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email_confirmed_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);


--
-- Name: agenda_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid,
    titulo text NOT NULL,
    descricao text,
    data_evento date NOT NULL,
    hora_evento time without time zone,
    tipo text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    prioridade text DEFAULT 'normal'::text,
    notificacao_enviada boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agenda_eventos_prioridade_check CHECK ((prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text]))),
    CONSTRAINT agenda_eventos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text]))),
    CONSTRAINT agenda_eventos_tipo_check CHECK ((tipo = ANY (ARRAY['retorno'::text, 'ajuste_dieta'::text, 'alteracao_treino'::text, 'avaliacao'::text, 'outro'::text])))
);


--
-- Name: alimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    quantidade_referencia_g numeric DEFAULT 100 NOT NULL,
    kcal_por_referencia numeric NOT NULL,
    cho_por_referencia numeric NOT NULL,
    ptn_por_referencia numeric NOT NULL,
    lip_por_referencia numeric NOT NULL,
    origem_ptn text NOT NULL,
    tipo_id uuid,
    info_adicional text,
    autor text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alimentos_origem_ptn_check CHECK ((origem_ptn = ANY (ARRAY['Vegetal'::text, 'Animal'::text, 'Mista'::text, 'N/A'::text])))
);


--
-- Name: alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text,
    email text DEFAULT ''::text NOT NULL,
    data_nascimento date,
    peso bigint,
    objetivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coach_id uuid,
    cpf_cnpj text,
    telefone text,
    plano text
);


--
-- Name: TABLE alunos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alunos IS 'Tabela principal de alunos do sistema';


--
-- Name: alunos_treinos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos_treinos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    treino_id uuid NOT NULL,
    data_inicio date DEFAULT CURRENT_DATE NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    data_expiracao date,
    dias_antecedencia_notificacao integer DEFAULT 7,
    notificacao_expiracao_enviada boolean DEFAULT false
);


--
-- Name: asaas_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asaas_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    is_sandbox boolean DEFAULT true NOT NULL,
    webhook_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asaas_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asaas_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    asaas_customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asaas_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asaas_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    asaas_payment_id text NOT NULL,
    asaas_customer_id text NOT NULL,
    value numeric NOT NULL,
    description text,
    billing_type text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    due_date date NOT NULL,
    invoice_url text,
    bank_slip_url text,
    pix_qr_code text,
    pix_copy_paste text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    tipo text DEFAULT 'individual'::text NOT NULL,
    anexo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avisos_destinatarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avisos_destinatarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aviso_id uuid NOT NULL,
    aluno_id uuid,
    turma_id uuid,
    lido boolean DEFAULT false NOT NULL,
    lido_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checkin_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkin_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    ultima_notificacao timestamp with time zone,
    proximo_lembrete timestamp with time zone NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: coach_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome_completo text,
    bio text,
    especialidades text[] DEFAULT '{}'::text[],
    conquistas jsonb DEFAULT '[]'::jsonb,
    anos_experiencia integer DEFAULT 0,
    total_alunos_acompanhados integer DEFAULT 0,
    principais_resultados text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    ultima_mensagem text,
    ultima_mensagem_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE conversas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversas IS 'Conversas entre coach e aluno';


--
-- Name: dieta_farmacos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dieta_farmacos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dieta_id uuid NOT NULL,
    nome text NOT NULL,
    dosagem text NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dietas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dietas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    aluno_id uuid NOT NULL,
    nome text NOT NULL,
    objetivo text,
    data_criacao timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text)
);


--
-- Name: TABLE dietas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.dietas IS 'Dietas prescritas para alunos';


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    turma_id uuid,
    titulo text NOT NULL,
    descricao text,
    data_inicio timestamp with time zone NOT NULL,
    hora_inicio time without time zone NOT NULL,
    duracao_minutos integer DEFAULT 60 NOT NULL,
    recorrencia text DEFAULT 'unica'::text NOT NULL,
    recorrencia_config jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'agendado'::text NOT NULL,
    link_online text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: eventos_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_participantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evento_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    confirmado boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    descricao text NOT NULL,
    valor numeric NOT NULL,
    categoria text NOT NULL,
    data_vencimento date NOT NULL,
    data_pagamento date,
    status text DEFAULT 'pendente'::text NOT NULL,
    forma_pagamento text,
    observacoes text,
    recorrente boolean DEFAULT false,
    frequencia_recorrencia text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_frequencia_recorrencia_check CHECK ((frequencia_recorrencia = ANY (ARRAY['mensal'::text, 'trimestral'::text, 'semestral'::text, 'anual'::text]))),
    CONSTRAINT expenses_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text])))
);


--
-- Name: feedbacks_alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks_alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    coach_id uuid NOT NULL,
    feedback text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: financial_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    motivo text NOT NULL,
    tipo text NOT NULL,
    valor_desconto numeric,
    percentual_desconto numeric,
    data_inicio date NOT NULL,
    data_fim date,
    observacoes text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_exceptions_tipo_check CHECK ((tipo = ANY (ARRAY['isento'::text, 'desconto'::text, 'acordo_pagamento'::text, 'bolsa'::text])))
);


--
-- Name: fotos_alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fotos_alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    url text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: itens_dieta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itens_dieta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dieta_id uuid NOT NULL,
    quantidade double precision NOT NULL,
    refeicao text NOT NULL,
    dia_semana text,
    alimento_id uuid
);


--
-- Name: lembretes_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lembretes_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evento_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    tipo_lembrete text NOT NULL,
    enviado boolean DEFAULT false NOT NULL,
    enviado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    youtube_stream_key text,
    youtube_url text,
    data_agendamento date NOT NULL,
    hora_agendamento time without time zone NOT NULL,
    duracao integer DEFAULT 60 NOT NULL,
    status text NOT NULL,
    visibilidade text NOT NULL,
    max_participantes integer DEFAULT 100,
    num_inscricoes integer DEFAULT 0,
    lembretes_ativados boolean DEFAULT true,
    auto_gravar boolean DEFAULT true,
    tags text[] DEFAULT '{}'::text[],
    coach_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lives_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text]))),
    CONSTRAINT lives_visibilidade_check CHECK ((visibilidade = ANY (ARRAY['active-students'::text, 'inactive-students'::text, 'guests'::text, 'everyone'::text])))
);


--
-- Name: mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversa_id uuid NOT NULL,
    remetente_id uuid NOT NULL,
    conteudo text NOT NULL,
    lida boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notificacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    nome text NOT NULL,
    valor numeric NOT NULL,
    descricao text,
    dia_vencimento integer NOT NULL,
    frequencia text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_plans_dia_vencimento_check CHECK (((dia_vencimento >= 1) AND (dia_vencimento <= 31))),
    CONSTRAINT payment_plans_frequencia_check CHECK ((frequencia = ANY (ARRAY['mensal'::text, 'trimestral'::text, 'semestral'::text, 'anual'::text])))
);


--
-- Name: planos_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planos_pagamento (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    nome text NOT NULL,
    valor numeric NOT NULL,
    frequencia text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: recurring_charges_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_charges_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    payment_plan_id uuid,
    valor_customizado numeric,
    dia_vencimento_customizado integer,
    ativo boolean DEFAULT true NOT NULL,
    enviar_lembrete boolean DEFAULT true,
    dias_antecedencia_lembrete integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurring_charges_config_dia_vencimento_customizado_check CHECK (((dia_vencimento_customizado >= 1) AND (dia_vencimento_customizado <= 31)))
);


--
-- Name: relatorio_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relatorio_feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    relatorio_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    comentario text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: relatorio_midias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relatorio_midias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    relatorio_id uuid NOT NULL,
    tipo text NOT NULL,
    url text NOT NULL,
    legenda text,
    ordem integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT relatorio_midias_tipo_check CHECK ((tipo = ANY (ARRAY['foto'::text, 'video'::text])))
);


--
-- Name: relatorio_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relatorio_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    campos jsonb DEFAULT '[]'::jsonb NOT NULL,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: relatorios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relatorios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    template_id uuid,
    titulo text NOT NULL,
    periodo_inicio date NOT NULL,
    periodo_fim date NOT NULL,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    observacoes text,
    metricas jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'rascunho'::text NOT NULL,
    enviado_em timestamp with time zone,
    visualizado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT relatorios_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'visualizado'::text])))
);


--
-- Name: tipos_alimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_alimentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_tipo text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: treinos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treinos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    duracao integer DEFAULT 60 NOT NULL,
    dificuldade text NOT NULL,
    categoria text NOT NULL,
    num_exercicios integer DEFAULT 0,
    is_template boolean DEFAULT false,
    tags text[] DEFAULT '{}'::text[],
    coach_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    exercicios jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT treinos_dificuldade_check CHECK ((dificuldade = ANY (ARRAY['Iniciante'::text, 'Intermediário'::text, 'Avançado'::text])))
);


--
-- Name: TABLE treinos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.treinos IS 'Treinos cadastrados pelos coaches';


--
-- Name: turmas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turmas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    nome text NOT NULL,
    descricao text,
    cor text DEFAULT '#3b82f6'::text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: turmas_alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turmas_alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    turma_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: twilio_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twilio_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    account_sid text,
    auth_token text,
    whatsapp_from text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text,
    youtube_id text NOT NULL,
    duracao text,
    categoria text NOT NULL,
    visibilidade text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    views integer DEFAULT 0,
    likes integer DEFAULT 0,
    instrutor text,
    coach_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT videos_visibilidade_check CHECK ((visibilidade = ANY (ARRAY['active-students'::text, 'inactive-students'::text, 'guests'::text, 'everyone'::text])))
);


--
-- Name: weekly_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    beliscou_fora_plano text NOT NULL,
    seguiu_plano_nota integer NOT NULL,
    apetite text NOT NULL,
    treinou_todas_sessoes boolean NOT NULL,
    desafiou_treinos boolean NOT NULL,
    fez_cardio boolean NOT NULL,
    seguiu_suplementacao boolean NOT NULL,
    recursos_hormonais text NOT NULL,
    ingeriu_agua_minima boolean NOT NULL,
    exposicao_sol boolean NOT NULL,
    pressao_arterial text,
    glicemia text,
    media_horas_sono text NOT NULL,
    dificuldade_adormecer boolean NOT NULL,
    acordou_noite text,
    estresse_semana boolean NOT NULL,
    lida_desafios text NOT NULL,
    convivio_familiar text NOT NULL,
    convivio_trabalho text NOT NULL,
    postura_problemas text NOT NULL,
    higiene_sono boolean NOT NULL,
    autoestima integer NOT NULL,
    media_evacuacoes text NOT NULL,
    formato_fezes text NOT NULL,
    nao_cumpriu_porque text,
    status text DEFAULT 'concluido'::text,
    CONSTRAINT weekly_checkins_apetite_check CHECK ((apetite = ANY (ARRAY['alto'::text, 'normal'::text, 'ruim'::text]))),
    CONSTRAINT weekly_checkins_autoestima_check CHECK (((autoestima >= 1) AND (autoestima <= 5))),
    CONSTRAINT weekly_checkins_beliscou_fora_plano_check CHECK ((beliscou_fora_plano = ANY (ARRAY['prejudicando'::text, 'comprometido'::text]))),
    CONSTRAINT weekly_checkins_convivio_familiar_check CHECK ((convivio_familiar = ANY (ARRAY['ruim'::text, 'bom'::text, 'otimo'::text]))),
    CONSTRAINT weekly_checkins_convivio_trabalho_check CHECK ((convivio_trabalho = ANY (ARRAY['ruim'::text, 'bom'::text, 'otimo'::text]))),
    CONSTRAINT weekly_checkins_formato_fezes_check CHECK ((formato_fezes = ANY (ARRAY['tipo1'::text, 'tipo2'::text, 'tipo3'::text, 'tipo4'::text, 'tipo5'::text, 'tipo6'::text, 'tipo7'::text]))),
    CONSTRAINT weekly_checkins_lida_desafios_check CHECK ((lida_desafios = ANY (ARRAY['nao_lida_bem'::text, 'as_vezes_abate'::text, 'lida_bem'::text]))),
    CONSTRAINT weekly_checkins_media_evacuacoes_check CHECK ((media_evacuacoes = ANY (ARRAY['dias_sem'::text, '1'::text, '2'::text, '3'::text, 'mais_4'::text]))),
    CONSTRAINT weekly_checkins_media_horas_sono_check CHECK ((media_horas_sono = ANY (ARRAY['4-5'::text, '5-6'::text, '6-8'::text]))),
    CONSTRAINT weekly_checkins_postura_problemas_check CHECK ((postura_problemas = ANY (ARRAY['nao_sabe_resolver'::text, 'resiliente'::text]))),
    CONSTRAINT weekly_checkins_recursos_hormonais_check CHECK ((recursos_hormonais = ANY (ARRAY['sim'::text, 'nao'::text, 'nao_uso'::text]))),
    CONSTRAINT weekly_checkins_seguiu_plano_nota_check CHECK (((seguiu_plano_nota >= 1) AND (seguiu_plano_nota <= 5)))
);


--
-- Name: TABLE weekly_checkins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.weekly_checkins IS 'Check-ins semanais dos alunos';


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: app_auth; Owner: -
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: app_auth; Owner: -
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app_auth; Owner: -
--

ALTER TABLE ONLY app_auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app_auth; Owner: -
--

ALTER TABLE ONLY app_auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: agenda_eventos agenda_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_eventos
    ADD CONSTRAINT agenda_eventos_pkey PRIMARY KEY (id);


--
-- Name: alimentos alimentos_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alimentos
    ADD CONSTRAINT alimentos_nome_key UNIQUE (nome);


--
-- Name: alimentos alimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alimentos
    ADD CONSTRAINT alimentos_pkey PRIMARY KEY (id);


--
-- Name: alunos alunos_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_email_key UNIQUE (email);


--
-- Name: alunos alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_pkey PRIMARY KEY (id);


--
-- Name: alunos_treinos alunos_treinos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_treinos
    ADD CONSTRAINT alunos_treinos_pkey PRIMARY KEY (id);


--
-- Name: asaas_config asaas_config_coach_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_config
    ADD CONSTRAINT asaas_config_coach_id_key UNIQUE (coach_id);


--
-- Name: asaas_config asaas_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_config
    ADD CONSTRAINT asaas_config_pkey PRIMARY KEY (id);


--
-- Name: asaas_customers asaas_customers_asaas_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_customers
    ADD CONSTRAINT asaas_customers_asaas_customer_id_key UNIQUE (asaas_customer_id);


--
-- Name: asaas_customers asaas_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_customers
    ADD CONSTRAINT asaas_customers_pkey PRIMARY KEY (id);


--
-- Name: asaas_payments asaas_payments_asaas_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_payments
    ADD CONSTRAINT asaas_payments_asaas_payment_id_key UNIQUE (asaas_payment_id);


--
-- Name: asaas_payments asaas_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_payments
    ADD CONSTRAINT asaas_payments_pkey PRIMARY KEY (id);


--
-- Name: avisos_destinatarios avisos_destinatarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_destinatarios
    ADD CONSTRAINT avisos_destinatarios_pkey PRIMARY KEY (id);


--
-- Name: avisos avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_pkey PRIMARY KEY (id);


--
-- Name: checkin_reminders checkin_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_reminders
    ADD CONSTRAINT checkin_reminders_pkey PRIMARY KEY (id);


--
-- Name: coach_profiles coach_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_pkey PRIMARY KEY (id);


--
-- Name: coach_profiles coach_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_user_id_key UNIQUE (user_id);


--
-- Name: conversas conversas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT conversas_pkey PRIMARY KEY (id);


--
-- Name: dieta_farmacos dieta_farmacos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dieta_farmacos
    ADD CONSTRAINT dieta_farmacos_pkey PRIMARY KEY (id);


--
-- Name: dietas dietas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dietas
    ADD CONSTRAINT dietas_pkey PRIMARY KEY (id);


--
-- Name: eventos_participantes eventos_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_participantes
    ADD CONSTRAINT eventos_participantes_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: feedbacks_alunos feedbacks_alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks_alunos
    ADD CONSTRAINT feedbacks_alunos_pkey PRIMARY KEY (id);


--
-- Name: financial_exceptions financial_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_exceptions
    ADD CONSTRAINT financial_exceptions_pkey PRIMARY KEY (id);


--
-- Name: fotos_alunos fotos_alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_alunos
    ADD CONSTRAINT fotos_alunos_pkey PRIMARY KEY (id);


--
-- Name: itens_dieta itens_dieta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_dieta
    ADD CONSTRAINT itens_dieta_pkey PRIMARY KEY (id);


--
-- Name: lembretes_eventos lembretes_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lembretes_eventos
    ADD CONSTRAINT lembretes_eventos_pkey PRIMARY KEY (id);


--
-- Name: lives lives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lives
    ADD CONSTRAINT lives_pkey PRIMARY KEY (id);


--
-- Name: mensagens mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_pkey PRIMARY KEY (id);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: planos_pagamento planos_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos_pagamento
    ADD CONSTRAINT planos_pagamento_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: recurring_charges_config recurring_charges_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charges_config
    ADD CONSTRAINT recurring_charges_config_pkey PRIMARY KEY (id);


--
-- Name: relatorio_feedbacks relatorio_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_feedbacks
    ADD CONSTRAINT relatorio_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: relatorio_midias relatorio_midias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_midias
    ADD CONSTRAINT relatorio_midias_pkey PRIMARY KEY (id);


--
-- Name: relatorio_templates relatorio_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_templates
    ADD CONSTRAINT relatorio_templates_pkey PRIMARY KEY (id);


--
-- Name: relatorios relatorios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorios
    ADD CONSTRAINT relatorios_pkey PRIMARY KEY (id);


--
-- Name: tipos_alimentos tipos_alimentos_nome_tipo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_alimentos
    ADD CONSTRAINT tipos_alimentos_nome_tipo_key UNIQUE (nome_tipo);


--
-- Name: tipos_alimentos tipos_alimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_alimentos
    ADD CONSTRAINT tipos_alimentos_pkey PRIMARY KEY (id);


--
-- Name: treinos treinos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treinos
    ADD CONSTRAINT treinos_pkey PRIMARY KEY (id);


--
-- Name: turmas_alunos turmas_alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas_alunos
    ADD CONSTRAINT turmas_alunos_pkey PRIMARY KEY (id);


--
-- Name: turmas turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_pkey PRIMARY KEY (id);


--
-- Name: twilio_config twilio_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twilio_config
    ADD CONSTRAINT twilio_config_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: weekly_checkins weekly_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_pkey PRIMARY KEY (id);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: app_auth; Owner: -
--

CREATE INDEX idx_sessions_expires ON app_auth.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: app_auth; Owner: -
--

CREATE INDEX idx_sessions_token ON app_auth.sessions USING btree (token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: app_auth; Owner: -
--

CREATE INDEX idx_sessions_user_id ON app_auth.sessions USING btree (user_id);


--
-- Name: idx_alunos_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_coach_id ON public.alunos USING btree (coach_id);


--
-- Name: idx_alunos_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_email ON public.alunos USING btree (email);


--
-- Name: idx_alunos_treinos_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_treinos_aluno_id ON public.alunos_treinos USING btree (aluno_id);


--
-- Name: idx_alunos_treinos_treino_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alunos_treinos_treino_id ON public.alunos_treinos USING btree (treino_id);


--
-- Name: idx_asaas_payments_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asaas_payments_aluno_id ON public.asaas_payments USING btree (aluno_id);


--
-- Name: idx_asaas_payments_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asaas_payments_coach_id ON public.asaas_payments USING btree (coach_id);


--
-- Name: idx_conversas_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversas_aluno_id ON public.conversas USING btree (aluno_id);


--
-- Name: idx_conversas_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversas_coach_id ON public.conversas USING btree (coach_id);


--
-- Name: idx_dietas_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dietas_aluno_id ON public.dietas USING btree (aluno_id);


--
-- Name: idx_eventos_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eventos_coach_id ON public.eventos USING btree (coach_id);


--
-- Name: idx_fotos_alunos_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fotos_alunos_aluno_id ON public.fotos_alunos USING btree (aluno_id);


--
-- Name: idx_mensagens_conversa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mensagens_conversa_id ON public.mensagens USING btree (conversa_id);


--
-- Name: idx_notificacoes_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_aluno_id ON public.notificacoes USING btree (aluno_id);


--
-- Name: idx_notificacoes_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_coach_id ON public.notificacoes USING btree (coach_id);


--
-- Name: idx_payment_plans_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_plans_coach_id ON public.payment_plans USING btree (coach_id);


--
-- Name: idx_treinos_coach_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treinos_coach_id ON public.treinos USING btree (coach_id);


--
-- Name: idx_weekly_checkins_aluno_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_checkins_aluno_id ON public.weekly_checkins USING btree (aluno_id);


--
-- Name: users on_user_created; Type: TRIGGER; Schema: app_auth; Owner: -
--

CREATE TRIGGER on_user_created AFTER INSERT ON app_auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: asaas_config update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.asaas_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asaas_customers update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.asaas_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asaas_payments update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.asaas_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coach_profiles update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.coach_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversas update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: eventos update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expenses update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: feedbacks_alunos update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.feedbacks_alunos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: financial_exceptions update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.financial_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lives update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.lives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notificacoes update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_plans update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: planos_pagamento update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.planos_pagamento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: recurring_charges_config update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.recurring_charges_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: relatorio_templates update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.relatorio_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: relatorios update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.relatorios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: treinos update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.treinos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: turmas update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: twilio_config update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.twilio_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: videos update_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app_auth; Owner: -
--

ALTER TABLE ONLY app_auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE;


--
-- Name: agenda_eventos agenda_eventos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_eventos
    ADD CONSTRAINT agenda_eventos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: agenda_eventos agenda_eventos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_eventos
    ADD CONSTRAINT agenda_eventos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: alimentos alimentos_novo_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alimentos
    ADD CONSTRAINT alimentos_novo_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.tipos_alimentos(id);


--
-- Name: alunos alunos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: alunos_treinos alunos_treinos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_treinos
    ADD CONSTRAINT alunos_treinos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: alunos_treinos alunos_treinos_treino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos_treinos
    ADD CONSTRAINT alunos_treinos_treino_id_fkey FOREIGN KEY (treino_id) REFERENCES public.treinos(id);


--
-- Name: asaas_config asaas_config_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_config
    ADD CONSTRAINT asaas_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: asaas_customers asaas_customers_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_customers
    ADD CONSTRAINT asaas_customers_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: asaas_payments asaas_payments_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_payments
    ADD CONSTRAINT asaas_payments_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: asaas_payments asaas_payments_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_payments
    ADD CONSTRAINT asaas_payments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: avisos avisos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: avisos_destinatarios avisos_destinatarios_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_destinatarios
    ADD CONSTRAINT avisos_destinatarios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: avisos_destinatarios avisos_destinatarios_aviso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_destinatarios
    ADD CONSTRAINT avisos_destinatarios_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.avisos(id);


--
-- Name: avisos_destinatarios avisos_destinatarios_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_destinatarios
    ADD CONSTRAINT avisos_destinatarios_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id);


--
-- Name: checkin_reminders checkin_reminders_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkin_reminders
    ADD CONSTRAINT checkin_reminders_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: coach_profiles coach_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id);


--
-- Name: conversas conversas_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT conversas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: conversas conversas_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT conversas_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: dieta_farmacos dieta_farmacos_dieta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dieta_farmacos
    ADD CONSTRAINT dieta_farmacos_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id);


--
-- Name: dietas dietas_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dietas
    ADD CONSTRAINT dietas_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: eventos eventos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: eventos_participantes eventos_participantes_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_participantes
    ADD CONSTRAINT eventos_participantes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: eventos_participantes eventos_participantes_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_participantes
    ADD CONSTRAINT eventos_participantes_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id);


--
-- Name: eventos eventos_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id);


--
-- Name: expenses expenses_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: feedbacks_alunos feedbacks_alunos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks_alunos
    ADD CONSTRAINT feedbacks_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: feedbacks_alunos feedbacks_alunos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks_alunos
    ADD CONSTRAINT feedbacks_alunos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: financial_exceptions financial_exceptions_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_exceptions
    ADD CONSTRAINT financial_exceptions_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: financial_exceptions financial_exceptions_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_exceptions
    ADD CONSTRAINT financial_exceptions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: fotos_alunos fotos_alunos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_alunos
    ADD CONSTRAINT fotos_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: itens_dieta itens_dieta_alimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_dieta
    ADD CONSTRAINT itens_dieta_alimento_id_fkey FOREIGN KEY (alimento_id) REFERENCES public.alimentos(id);


--
-- Name: itens_dieta itens_dieta_dieta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itens_dieta
    ADD CONSTRAINT itens_dieta_dieta_id_fkey FOREIGN KEY (dieta_id) REFERENCES public.dietas(id);


--
-- Name: lembretes_eventos lembretes_eventos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lembretes_eventos
    ADD CONSTRAINT lembretes_eventos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: lembretes_eventos lembretes_eventos_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lembretes_eventos
    ADD CONSTRAINT lembretes_eventos_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id);


--
-- Name: lives lives_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lives
    ADD CONSTRAINT lives_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: mensagens mensagens_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES public.conversas(id);


--
-- Name: mensagens mensagens_remetente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES app_auth.users(id);


--
-- Name: notificacoes notificacoes_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: notificacoes notificacoes_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: payment_plans payment_plans_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: planos_pagamento planos_pagamento_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos_pagamento
    ADD CONSTRAINT planos_pagamento_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES app_auth.users(id);


--
-- Name: recurring_charges_config recurring_charges_config_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charges_config
    ADD CONSTRAINT recurring_charges_config_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: recurring_charges_config recurring_charges_config_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charges_config
    ADD CONSTRAINT recurring_charges_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: recurring_charges_config recurring_charges_config_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_charges_config
    ADD CONSTRAINT recurring_charges_config_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: relatorio_feedbacks relatorio_feedbacks_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_feedbacks
    ADD CONSTRAINT relatorio_feedbacks_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: relatorio_feedbacks relatorio_feedbacks_relatorio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_feedbacks
    ADD CONSTRAINT relatorio_feedbacks_relatorio_id_fkey FOREIGN KEY (relatorio_id) REFERENCES public.relatorios(id);


--
-- Name: relatorio_midias relatorio_midias_relatorio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_midias
    ADD CONSTRAINT relatorio_midias_relatorio_id_fkey FOREIGN KEY (relatorio_id) REFERENCES public.relatorios(id);


--
-- Name: relatorio_templates relatorio_templates_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorio_templates
    ADD CONSTRAINT relatorio_templates_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: relatorios relatorios_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorios
    ADD CONSTRAINT relatorios_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: relatorios relatorios_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relatorios
    ADD CONSTRAINT relatorios_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: treinos treinos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treinos
    ADD CONSTRAINT treinos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: turmas_alunos turmas_alunos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas_alunos
    ADD CONSTRAINT turmas_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- Name: turmas_alunos turmas_alunos_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas_alunos
    ADD CONSTRAINT turmas_alunos_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id);


--
-- Name: turmas turmas_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: twilio_config twilio_config_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twilio_config
    ADD CONSTRAINT twilio_config_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE;


--
-- Name: videos videos_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);


--
-- Name: weekly_checkins weekly_checkins_aluno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id);


--
-- PostgreSQL database dump complete
--

