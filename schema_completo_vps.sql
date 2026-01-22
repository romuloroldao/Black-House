-- ============================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - SISTEMA DE GESTÃO PARA COACHES
-- ============================================================================
-- Remoção completa do Supabase - 100% VPS PostgreSQL
-- Todas as referências a auth.users foram substituídas por app_auth.users
-- Todas as referências a auth.jwt() e auth.uid() foram removidas
-- ============================================================================

-- ============================================================================
-- SCHEMA: app_auth (Autenticação própria)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app_auth;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Função para hash de senha
CREATE OR REPLACE FUNCTION app_auth.hash_password(password TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION app_auth.verify_password(password TEXT, hash TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tabela de usuários (autenticação própria)
CREATE TABLE IF NOT EXISTS app_auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_auth_users_email ON app_auth.users(email);

COMMENT ON TABLE app_auth.users IS 'Usuários autenticados do sistema (substitui auth.users do Supabase)';
COMMENT ON COLUMN app_auth.users.email IS 'Email único do usuário';
COMMENT ON COLUMN app_auth.users.password_hash IS 'Hash da senha (bcrypt via pgcrypto)';

-- Tabela de sessões (opcional - para refresh tokens)
CREATE TABLE IF NOT EXISTS app_auth.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_user_id ON app_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_auth_sessions_expires_at ON app_auth.sessions(expires_at);

COMMENT ON TABLE app_auth.sessions IS 'Sessões de usuário (opcional - para refresh tokens)';

-- Função para criar usuário
CREATE OR REPLACE FUNCTION app_auth.create_user(p_email TEXT, p_password TEXT) 
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

-- Função para login (retorna user_id se credenciais válidas)
CREATE OR REPLACE FUNCTION app_auth.login(p_email TEXT, p_password TEXT) 
RETURNS TABLE(user_id UUID) AS $$
DECLARE
    v_user app_auth.users%ROWTYPE;
BEGIN
    SELECT * INTO v_user 
    FROM app_auth.users 
    WHERE email = LOWER(p_email);
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;
    
    IF NOT app_auth.verify_password(p_password, v_user.password_hash) THEN
        RAISE EXCEPTION 'Credenciais inválidas';
    END IF;
    
    RETURN QUERY SELECT v_user.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar sessões expiradas
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

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'coach', 'student');

-- ============================================================================
-- TABELAS DO DOMÍNIO (Schema: public)
-- ============================================================================

-- Tabela: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES app_auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Perfis de usuário (vinculado ao app_auth.users)';

-- Tabela: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
COMMENT ON TABLE user_roles IS 'Papéis de usuário (admin, coach, student)';

-- Tabela: alunos
CREATE TABLE IF NOT EXISTS alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE SET NULL,
    linked_user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE SET NULL,
    nome TEXT,
    email TEXT NOT NULL DEFAULT '',
    telefone TEXT,
    cpf_cnpj TEXT,
    data_nascimento DATE,
    peso BIGINT,
    objetivo TEXT,
    plano TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON alunos(coach_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id_unique ON alunos(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_email ON alunos(email);

-- VPS-NATIVE-ARCH-ALUNOS-COACH-001: Constraint para garantir linked_user_id único
-- Um usuário só pode estar vinculado a um aluno
ALTER TABLE public.alunos 
DROP CONSTRAINT IF EXISTS alunos_linked_user_id_unique;

COMMENT ON TABLE alunos IS 'Cadastro principal de alunos';
COMMENT ON COLUMN alunos.linked_user_id IS 'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.';
COMMENT ON COLUMN alunos.email IS 'Email usado para vincular o aluno ao usuário autenticado';

-- Tabela: alunos_user_link_history (histórico de vinculações)
CREATE TABLE IF NOT EXISTS alunos_user_link_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    linked_user_id UUID REFERENCES app_auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'linked' ou 'unlinked'
    performed_by UUID REFERENCES app_auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_alunos_user_link_history_aluno_id ON alunos_user_link_history(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_user_link_history_linked_user_id ON alunos_user_link_history(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_alunos_user_link_history_performed_at ON alunos_user_link_history(performed_at);

COMMENT ON TABLE alunos_user_link_history IS 'Histórico de vinculações e desvinculações de usuários aos alunos';

-- Tabela: payment_plans
CREATE TABLE IF NOT EXISTS payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor NUMERIC NOT NULL,
    frequencia TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_coach_id ON payment_plans(coach_id);

COMMENT ON TABLE payment_plans IS 'Planos de pagamento';
COMMENT ON COLUMN payment_plans.frequencia IS 'Frequência: mensal, trimestral, anual';
COMMENT ON COLUMN payment_plans.dia_vencimento IS 'Dia do vencimento (1-31)';

-- Tabela: notificacoes
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL,
    link TEXT,
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_coach_id ON notificacoes(coach_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno_id ON notificacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);

COMMENT ON TABLE notificacoes IS 'Notificações do sistema';
COMMENT ON COLUMN notificacoes.tipo IS 'Tipo: info, alerta, sucesso, erro';

-- ============================================================================
-- OUTRAS TABELAS DO DOMÍNIO (mantidas do schema original, com referências atualizadas)
-- ============================================================================

-- Tabela: agenda_eventos
CREATE TABLE IF NOT EXISTS agenda_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_evento DATE NOT NULL,
    hora_evento TIME,
    tipo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    prioridade TEXT DEFAULT 'normal',
    notificacao_enviada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE agenda_eventos IS 'Eventos agendados na agenda do coach';

-- Tabela: alimentos
CREATE TABLE IF NOT EXISTS alimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    origem_ptn TEXT NOT NULL,
    tipo_id UUID,
    quantidade_referencia_g NUMERIC NOT NULL DEFAULT 100,
    kcal_por_referencia NUMERIC NOT NULL,
    ptn_por_referencia NUMERIC NOT NULL,
    cho_por_referencia NUMERIC NOT NULL,
    lip_por_referencia NUMERIC NOT NULL,
    info_adicional TEXT,
    autor TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE alimentos IS 'Cadastro de alimentos para criação de dietas';

-- Tabela: alunos_treinos
CREATE TABLE IF NOT EXISTS alunos_treinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    treino_id UUID NOT NULL REFERENCES treinos(id) ON DELETE CASCADE,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_expiracao DATE,
    ativo BOOLEAN DEFAULT true,
    dias_antecedencia_notificacao INTEGER DEFAULT 7,
    notificacao_expiracao_enviada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alunos_treinos_aluno_id ON alunos_treinos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_treinos_treino_id ON alunos_treinos(treino_id);

COMMENT ON TABLE alunos_treinos IS 'Relação entre alunos e treinos atribuídos';

-- Tabela: treinos (precisa ser criada antes de alunos_treinos)
CREATE TABLE IF NOT EXISTS treinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    exercicios JSONB DEFAULT '[]',
    dias_semana TEXT[] DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE treinos IS 'Treinos cadastrados';

-- Tabela: asaas_config
CREATE TABLE IF NOT EXISTS asaas_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    is_sandbox BOOLEAN NOT NULL DEFAULT true,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE asaas_config IS 'Configuração da integração com Asaas (gateway de pagamento)';

-- Tabela: asaas_customers
CREATE TABLE IF NOT EXISTS asaas_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    asaas_customer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE asaas_customers IS 'Clientes cadastrados no Asaas';

-- Tabela: asaas_payments
CREATE TABLE IF NOT EXISTS asaas_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    asaas_payment_id TEXT NOT NULL,
    asaas_customer_id TEXT NOT NULL,
    value NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    billing_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    description TEXT,
    invoice_url TEXT,
    bank_slip_url TEXT,
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_payments_aluno_id ON asaas_payments(aluno_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_status ON asaas_payments(status);

COMMENT ON TABLE asaas_payments IS 'Pagamentos registrados via Asaas';

-- Tabela: avisos
CREATE TABLE IF NOT EXISTS avisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'individual',
    anexo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE avisos IS 'Avisos enviados pelo coach';

-- Tabela: avisos_destinatarios
CREATE TABLE IF NOT EXISTS avisos_destinatarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aviso_id UUID NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
    aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
    turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
    lido BOOLEAN NOT NULL DEFAULT false,
    lido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: turmas (precisa ser criada antes de avisos_destinatarios)
CREATE TABLE IF NOT EXISTS turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT,
    ativa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE turmas IS 'Turmas/grupos de alunos';

-- Tabela: checkin_reminders
CREATE TABLE IF NOT EXISTS checkin_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    ativo BOOLEAN DEFAULT true,
    proximo_lembrete TIMESTAMPTZ NOT NULL,
    ultima_notificacao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE checkin_reminders IS 'Lembretes de check-in semanal';

-- Tabela: coach_profiles
CREATE TABLE IF NOT EXISTS coach_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    nome_completo TEXT,
    bio TEXT,
    avatar_url TEXT,
    especialidades TEXT[] DEFAULT '{}',
    anos_experiencia INTEGER DEFAULT 0,
    total_alunos_acompanhados INTEGER DEFAULT 0,
    principais_resultados TEXT,
    conquistas JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE coach_profiles IS 'Perfil do coach';

-- Tabela: conversas
CREATE TABLE IF NOT EXISTS conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    ultima_mensagem TEXT,
    ultima_mensagem_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversas_coach_id ON conversas(coach_id);
CREATE INDEX IF NOT EXISTS idx_conversas_aluno_id ON conversas(aluno_id);

COMMENT ON TABLE conversas IS 'Conversas de chat entre coach e aluno';

-- Tabela: mensagens
CREATE TABLE IF NOT EXISTS mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL,
    conteudo TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens(conversa_id);

COMMENT ON TABLE mensagens IS 'Mensagens do chat';

-- Tabela: dietas
CREATE TABLE IF NOT EXISTS dietas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    objetivo TEXT,
    data_criacao TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dietas IS 'Dietas criadas para alunos';

-- Tabela: dieta_farmacos
CREATE TABLE IF NOT EXISTS dieta_farmacos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dieta_id UUID NOT NULL REFERENCES dietas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    dosagem TEXT NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dieta_farmacos IS 'Fármacos/suplementos associados às dietas';

-- Tabela: itens_dieta
CREATE TABLE IF NOT EXISTS itens_dieta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dieta_id UUID NOT NULL REFERENCES dietas(id) ON DELETE CASCADE,
    alimento_id UUID REFERENCES alimentos(id) ON DELETE SET NULL,
    refeicao TEXT NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    dia_semana TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE itens_dieta IS 'Itens/alimentos de cada dieta';

-- Tabela: eventos
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMPTZ NOT NULL,
    hora_inicio TIME NOT NULL,
    duracao_minutos INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'agendado',
    recorrencia TEXT NOT NULL DEFAULT 'unica',
    recorrencia_config JSONB DEFAULT '{}',
    link_online TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE eventos IS 'Eventos/lives do coach';

-- Tabela: eventos_participantes
CREATE TABLE IF NOT EXISTS eventos_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    confirmado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE eventos_participantes IS 'Participantes dos eventos';

-- Tabela: expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    categoria TEXT NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status TEXT NOT NULL DEFAULT 'pendente',
    forma_pagamento TEXT,
    recorrente BOOLEAN DEFAULT false,
    frequencia_recorrencia TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE expenses IS 'Despesas do coach';

-- Tabela: feedbacks_alunos
CREATE TABLE IF NOT EXISTS feedbacks_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE feedbacks_alunos IS 'Feedbacks dados pelo coach aos alunos';

-- Tabela: financial_exceptions
CREATE TABLE IF NOT EXISTS financial_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    motivo TEXT NOT NULL,
    percentual_desconto NUMERIC,
    valor_desconto NUMERIC,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE financial_exceptions IS 'Exceções financeiras (descontos, isenções)';

-- Tabela: fotos_alunos
CREATE TABLE IF NOT EXISTS fotos_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE fotos_alunos IS 'Fotos de progresso dos alunos';

-- Tabela: lembretes_eventos
CREATE TABLE IF NOT EXISTS lembretes_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    tipo_lembrete TEXT NOT NULL,
    enviado BOOLEAN NOT NULL DEFAULT false,
    enviado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE lembretes_eventos IS 'Lembretes enviados para eventos';

-- Tabela: lives
CREATE TABLE IF NOT EXISTS lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES app_auth.users(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    duracao INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL,
    visibilidade TEXT NOT NULL,
    youtube_url TEXT,
    youtube_stream_key TEXT,
    max_participantes INTEGER DEFAULT 100,
    num_inscricoes INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    auto_gravar BOOLEAN DEFAULT true,
    lembretes_ativados BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE lives IS 'Lives agendadas pelo coach';

-- Tabela: planos_pagamento (LEGACY)
CREATE TABLE IF NOT EXISTS planos_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    frequencia TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE planos_pagamento IS 'Planos de pagamento (tabela legada)';

-- Tabela: recurring_charges_config
CREATE TABLE IF NOT EXISTS recurring_charges_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    payment_plan_id UUID REFERENCES payment_plans(id) ON DELETE SET NULL,
    valor_customizado NUMERIC,
    dia_vencimento_customizado INTEGER,
    ativo BOOLEAN NOT NULL DEFAULT true,
    enviar_lembrete BOOLEAN DEFAULT true,
    dias_antecedencia_lembrete INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recurring_charges_config IS 'Configuração de cobranças recorrentes';

-- Tabela: relatorio_feedbacks
CREATE TABLE IF NOT EXISTS relatorio_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_id UUID NOT NULL,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    comentario TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE relatorio_feedbacks IS 'Feedbacks em relatórios';

-- Tabela: relatorio_midias
CREATE TABLE IF NOT EXISTS relatorio_midias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_id UUID NOT NULL,
    url TEXT NOT NULL,
    tipo TEXT NOT NULL,
    legenda TEXT,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE relatorio_midias IS 'Mídias dos relatórios';

-- Tabela: turmas_alunos
CREATE TABLE IF NOT EXISTS turmas_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turmas_alunos_turma_id ON turmas_alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_turmas_alunos_aluno_id ON turmas_alunos(aluno_id);

COMMENT ON TABLE turmas_alunos IS 'Relação turma ↔ aluno';

-- Tabela: videos
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descricao TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    categoria TEXT,
    tags TEXT[] DEFAULT '{}',
    visibilidade TEXT DEFAULT 'privado',
    duracao_segundos INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE videos IS 'Vídeos cadastrados pelo coach';

-- Tabela: weekly_checkins
CREATE TABLE IF NOT EXISTS weekly_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    peso NUMERIC,
    nivel_energia INTEGER,
    qualidade_sono INTEGER,
    nivel_estresse INTEGER,
    adesao_dieta INTEGER,
    adesao_treino INTEGER,
    observacoes TEXT,
    escala_bristol INTEGER,
    data_checkin DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_aluno_id ON weekly_checkins(aluno_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_data_checkin ON weekly_checkins(data_checkin);

COMMENT ON TABLE weekly_checkins IS 'Check-ins semanais dos alunos';

-- ============================================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_app_auth_users_updated_at BEFORE UPDATE ON app_auth.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agenda_eventos_updated_at BEFORE UPDATE ON agenda_eventos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_asaas_config_updated_at BEFORE UPDATE ON asaas_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_asaas_customers_updated_at BEFORE UPDATE ON asaas_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_asaas_payments_updated_at BEFORE UPDATE ON asaas_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coach_profiles_updated_at BEFORE UPDATE ON coach_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON conversas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON eventos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feedbacks_alunos_updated_at BEFORE UPDATE ON feedbacks_alunos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_financial_exceptions_updated_at BEFORE UPDATE ON financial_exceptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lives_updated_at BEFORE UPDATE ON lives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notificacoes_updated_at BEFORE UPDATE ON notificacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON payment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planos_pagamento_updated_at BEFORE UPDATE ON planos_pagamento FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_charges_config_updated_at BEFORE UPDATE ON recurring_charges_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treinos_updated_at BEFORE UPDATE ON treinos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON turmas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_checkins_updated_at BEFORE UPDATE ON weekly_checkins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNÇÃO PARA REGISTRAR HISTÓRICO DE VINCULAÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_user_link_history(
    p_aluno_id UUID,
    p_linked_user_id UUID,
    p_action TEXT,
    p_performed_by UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    history_id UUID;
BEGIN
    INSERT INTO alunos_user_link_history (
        aluno_id,
        linked_user_id,
        action,
        performed_by,
        notes
    ) VALUES (
        p_aluno_id,
        p_linked_user_id,
        p_action,
        p_performed_by,
        p_notes
    ) RETURNING id INTO history_id;
    
    RETURN history_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.record_user_link_history IS 'Registra histórico de vinculação/desvinculação de usuários aos alunos';

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
