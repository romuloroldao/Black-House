-- ============================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - SISTEMA DE GESTÃO PARA COACHES
-- ============================================================================
-- Este arquivo contém a estrutura completa de todas as tabelas do sistema
-- Baseado na documentação detalhada fornecida
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'coach', 'student');

-- ============================================================================
-- TABELA 1: agenda_eventos
-- ============================================================================

CREATE TABLE IF NOT EXISTS agenda_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID REFERENCES alunos(id),
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
COMMENT ON COLUMN agenda_eventos.tipo IS 'Tipo: consulta, avaliacao, etc';
COMMENT ON COLUMN agenda_eventos.status IS 'Status: pendente, concluido, cancelado';
COMMENT ON COLUMN agenda_eventos.prioridade IS 'Prioridade: baixa, normal, alta';

-- ============================================================================
-- TABELA 2: alimentos
-- ============================================================================

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
COMMENT ON COLUMN alimentos.origem_ptn IS 'Origem proteína: animal, vegetal, mista';
COMMENT ON COLUMN alimentos.quantidade_referencia_g IS 'Quantidade de referência em gramas';

-- ============================================================================
-- TABELA 3: alunos
-- ============================================================================

CREATE TABLE IF NOT EXISTS alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES auth.users(id),
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

COMMENT ON TABLE alunos IS 'Cadastro principal de alunos';
COMMENT ON COLUMN alunos.email IS 'Email usado para vincular o aluno ao usuário autenticado via auth.jwt() ->> email';

-- ============================================================================
-- TABELA 4: alunos_treinos
-- ============================================================================

CREATE TABLE IF NOT EXISTS alunos_treinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    treino_id UUID NOT NULL REFERENCES treinos(id),
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_expiracao DATE,
    ativo BOOLEAN DEFAULT true,
    dias_antecedencia_notificacao INTEGER DEFAULT 7,
    notificacao_expiracao_enviada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE alunos_treinos IS 'Relação entre alunos e treinos atribuídos';

-- ============================================================================
-- TABELA 5: asaas_config
-- ============================================================================

CREATE TABLE IF NOT EXISTS asaas_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    is_sandbox BOOLEAN NOT NULL DEFAULT true,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE asaas_config IS 'Configuração da integração com Asaas (gateway de pagamento)';
COMMENT ON COLUMN asaas_config.is_sandbox IS 'Se usa ambiente sandbox';
COMMENT ON COLUMN asaas_config.webhook_url IS 'URL do webhook';
COMMENT ON TABLE asaas_config IS 'NOTA: A API Key do Asaas é armazenada como secret, não no banco';

-- ============================================================================
-- TABELA 6: asaas_customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS asaas_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    asaas_customer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE asaas_customers IS 'Clientes cadastrados no Asaas';

-- ============================================================================
-- TABELA 7: asaas_payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS asaas_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
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

COMMENT ON TABLE asaas_payments IS 'Pagamentos registrados via Asaas';
COMMENT ON COLUMN asaas_payments.billing_type IS 'Tipo: PIX, BOLETO, CREDIT_CARD';
COMMENT ON COLUMN asaas_payments.status IS 'Status: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, RECEIVED_IN_CASH, REFUND_REQUESTED, REFUND_IN_PROGRESS, CHARGEBACK_REQUESTED, CHARGEBACK_DISPUTE, AWAITING_CHARGEBACK_REVERSAL, DUNNING_REQUESTED, DUNNING_RECEIVED, AWAITING_RISK_ANALYSIS';

-- ============================================================================
-- TABELA 8: avisos
-- ============================================================================

CREATE TABLE IF NOT EXISTS avisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'individual',
    anexo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE avisos IS 'Avisos enviados pelo coach';
COMMENT ON COLUMN avisos.tipo IS 'Tipo: individual, turma, geral';

-- ============================================================================
-- TABELA 9: avisos_destinatarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS avisos_destinatarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aviso_id UUID NOT NULL REFERENCES avisos(id),
    aluno_id UUID REFERENCES alunos(id),
    turma_id UUID REFERENCES turmas(id),
    lido BOOLEAN NOT NULL DEFAULT false,
    lido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE avisos_destinatarios IS 'Destinatários dos avisos';

-- ============================================================================
-- TABELA 10: checkin_reminders
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkin_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    ativo BOOLEAN DEFAULT true,
    proximo_lembrete TIMESTAMPTZ NOT NULL,
    ultima_notificacao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE checkin_reminders IS 'Lembretes de check-in semanal';

-- ============================================================================
-- TABELA 11: coach_profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
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

-- ============================================================================
-- TABELA 12: conversas
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    ultima_mensagem TEXT,
    ultima_mensagem_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE conversas IS 'Conversas de chat entre coach e aluno';

-- ============================================================================
-- TABELA 13: dietas
-- ============================================================================

CREATE TABLE IF NOT EXISTS dietas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL DEFAULT auth.uid() REFERENCES alunos(id),
    nome TEXT NOT NULL,
    objetivo TEXT,
    data_criacao TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'utc'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dietas IS 'Dietas criadas para alunos';

-- ============================================================================
-- TABELA 14: dieta_farmacos
-- ============================================================================

CREATE TABLE IF NOT EXISTS dieta_farmacos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dieta_id UUID NOT NULL REFERENCES dietas(id),
    nome TEXT NOT NULL,
    dosagem TEXT NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dieta_farmacos IS 'Fármacos/suplementos associados às dietas';

-- ============================================================================
-- TABELA 15: eventos
-- ============================================================================

CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    turma_id UUID REFERENCES turmas(id),
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
COMMENT ON COLUMN eventos.status IS 'Status: agendado, em_andamento, concluido, cancelado';
COMMENT ON COLUMN eventos.recorrencia IS 'Recorrência: unica, semanal, mensal';

-- ============================================================================
-- TABELA 16: eventos_participantes
-- ============================================================================

CREATE TABLE IF NOT EXISTS eventos_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    confirmado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE eventos_participantes IS 'Participantes dos eventos';

-- ============================================================================
-- TABELA 17: expenses
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
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
COMMENT ON COLUMN expenses.status IS 'Status: pendente, pago, atrasado';

-- ============================================================================
-- TABELA 18: feedbacks_alunos
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedbacks_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE feedbacks_alunos IS 'Feedbacks dados pelo coach aos alunos';

-- ============================================================================
-- TABELA 19: financial_exceptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
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
COMMENT ON COLUMN financial_exceptions.tipo IS 'Tipo: desconto_percentual, desconto_valor, isencao';

-- ============================================================================
-- TABELA 20: fotos_alunos
-- ============================================================================

CREATE TABLE IF NOT EXISTS fotos_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    url TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE fotos_alunos IS 'Fotos de progresso dos alunos';

-- ============================================================================
-- TABELA 21: itens_dieta
-- ============================================================================

CREATE TABLE IF NOT EXISTS itens_dieta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dieta_id UUID DEFAULT auth.uid() REFERENCES dietas(id),
    alimento_id UUID REFERENCES alimentos(id),
    refeicao TEXT NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    dia_semana TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE itens_dieta IS 'Itens/alimentos de cada dieta';
COMMENT ON COLUMN itens_dieta.quantidade IS 'Quantidade em gramas';
COMMENT ON COLUMN itens_dieta.dia_semana IS 'Dia da semana (null = todos)';

-- ============================================================================
-- TABELA 22: lembretes_eventos
-- ============================================================================

CREATE TABLE IF NOT EXISTS lembretes_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventos(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    tipo_lembrete TEXT NOT NULL,
    enviado BOOLEAN NOT NULL DEFAULT false,
    enviado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE lembretes_eventos IS 'Lembretes enviados para eventos';
COMMENT ON COLUMN lembretes_eventos.tipo_lembrete IS 'Tipo: 24h, 1h, etc';

-- ============================================================================
-- TABELA 23: lives
-- ============================================================================

CREATE TABLE IF NOT EXISTS lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES auth.users(id),
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
COMMENT ON COLUMN lives.status IS 'Status: agendada, ao_vivo, encerrada, cancelada';
COMMENT ON COLUMN lives.visibilidade IS 'Visibilidade: publica, privada, turma';

-- ============================================================================
-- TABELA 24: mensagens
-- ============================================================================

CREATE TABLE IF NOT EXISTS mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES conversas(id),
    remetente_id UUID NOT NULL,
    conteudo TEXT NOT NULL,
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE mensagens IS 'Mensagens do chat';
COMMENT ON COLUMN mensagens.remetente_id IS 'ID do remetente (coach ou aluno)';

-- ============================================================================
-- TABELA 25: notificacoes
-- ============================================================================

CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID REFERENCES alunos(id),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL,
    link TEXT,
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notificacoes IS 'Notificações do sistema';
COMMENT ON COLUMN notificacoes.tipo IS 'Tipo: info, alerta, sucesso, erro';

-- ============================================================================
-- TABELA 26: payment_plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    valor NUMERIC NOT NULL,
    frequencia TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE payment_plans IS 'Planos de pagamento';
COMMENT ON COLUMN payment_plans.frequencia IS 'Frequência: mensal, trimestral, anual';
COMMENT ON COLUMN payment_plans.dia_vencimento IS 'Dia do vencimento (1-31)';

-- ============================================================================
-- TABELA 27: planos_pagamento (LEGACY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS planos_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    frequencia TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE planos_pagamento IS 'Planos de pagamento (tabela legada)';

-- ============================================================================
-- TABELA 28: profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Perfis de usuário (vinculado ao auth)';
COMMENT ON COLUMN profiles.id IS 'Mesmo ID do auth.users';

-- ============================================================================
-- TABELA 29: recurring_charges_config
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_charges_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    payment_plan_id UUID REFERENCES payment_plans(id),
    valor_customizado NUMERIC,
    dia_vencimento_customizado INTEGER,
    ativo BOOLEAN NOT NULL DEFAULT true,
    enviar_lembrete BOOLEAN DEFAULT true,
    dias_antecedencia_lembrete INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE recurring_charges_config IS 'Configuração de cobranças recorrentes';

-- ============================================================================
-- TABELA 30: relatorio_feedbacks
-- ============================================================================

CREATE TABLE IF NOT EXISTS relatorio_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relatorio_id UUID NOT NULL,
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    comentario TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE relatorio_feedbacks IS 'Feedbacks em relatórios';
COMMENT ON COLUMN relatorio_feedbacks.relatorio_id IS 'FK → relatorios.id (tabela não documentada)';

-- ============================================================================
-- TABELA 31: relatorio_midias
-- ============================================================================

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
COMMENT ON COLUMN relatorio_midias.relatorio_id IS 'FK → relatorios.id (tabela não documentada)';
COMMENT ON COLUMN relatorio_midias.tipo IS 'Tipo: imagem, video';

-- ============================================================================
-- TABELA 32: treinos
-- ============================================================================

CREATE TABLE IF NOT EXISTS treinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    exercicios JSONB DEFAULT '[]',
    dias_semana TEXT[] DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE treinos IS 'Treinos cadastrados';
COMMENT ON COLUMN treinos.exercicios IS 'Array JSON de exercícios com estrutura: [{"nome": "Supino Reto", "series": 4, "repeticoes": "8-12", "descanso": "90s", "observacoes": "..."}]';

-- ============================================================================
-- TABELA 33: turmas
-- ============================================================================

CREATE TABLE IF NOT EXISTS turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT,
    ativa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE turmas IS 'Turmas/grupos de alunos';

-- ============================================================================
-- TABELA 34: turmas_alunos
-- ============================================================================

CREATE TABLE IF NOT EXISTS turmas_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id UUID NOT NULL REFERENCES turmas(id),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE turmas_alunos IS 'Relação turma ↔ aluno';

-- ============================================================================
-- TABELA 35: user_roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_roles IS 'Papéis de usuário';
COMMENT ON COLUMN user_roles.role IS 'Enum: admin, coach, student';

-- ============================================================================
-- TABELA 36: videos
-- ============================================================================

CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id),
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
COMMENT ON COLUMN videos.visibilidade IS 'Visibilidade: publico, privado, turma';

-- ============================================================================
-- TABELA 37: weekly_checkins
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES alunos(id),
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

COMMENT ON TABLE weekly_checkins IS 'Check-ins semanais dos alunos';
COMMENT ON COLUMN weekly_checkins.nivel_energia IS 'Nível energia (1-10)';
COMMENT ON COLUMN weekly_checkins.qualidade_sono IS 'Qualidade sono (1-10)';
COMMENT ON COLUMN weekly_checkins.nivel_estresse IS 'Nível estresse (1-10)';
COMMENT ON COLUMN weekly_checkins.adesao_dieta IS 'Adesão dieta (1-10)';
COMMENT ON COLUMN weekly_checkins.adesao_treino IS 'Adesão treino (1-10)';
COMMENT ON COLUMN weekly_checkins.escala_bristol IS 'Escala Bristol (1-7)';

-- ============================================================================
-- ÍNDICES RECOMENDADOS
-- ============================================================================

-- Índices para melhorar performance de queries comuns

CREATE INDEX IF NOT EXISTS idx_alunos_coach_id ON alunos(coach_id);
CREATE INDEX IF NOT EXISTS idx_alunos_email ON alunos(email);
CREATE INDEX IF NOT EXISTS idx_alunos_treinos_aluno_id ON alunos_treinos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_treinos_treino_id ON alunos_treinos(treino_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_aluno_id ON asaas_payments(aluno_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_status ON asaas_payments(status);
CREATE INDEX IF NOT EXISTS idx_conversas_coach_id ON conversas(coach_id);
CREATE INDEX IF NOT EXISTS idx_conversas_aluno_id ON conversas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno_id ON notificacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_turmas_alunos_turma_id ON turmas_alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_turmas_alunos_aluno_id ON turmas_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_aluno_id ON weekly_checkins(aluno_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_data_checkin ON weekly_checkins(data_checkin);

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
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_charges_config_updated_at BEFORE UPDATE ON recurring_charges_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treinos_updated_at BEFORE UPDATE ON treinos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON turmas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_checkins_updated_at BEFORE UPDATE ON weekly_checkins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
