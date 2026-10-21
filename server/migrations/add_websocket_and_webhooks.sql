-- Migração: Adicionar suporte para WebSocket e Webhooks
-- Data: 12 de Janeiro de 2026

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON public.notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_read ON public.notificacoes(read);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

-- Tabela de eventos de webhook
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL, -- 'asaas', 'outro'
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON public.webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Adicionar colunas ao asaas_payments se não existirem
DO $$ 
BEGIN
    -- asaas_payment_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'asaas_payment_id'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN asaas_payment_id VARCHAR(255);
    END IF;

    -- asaas_customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'asaas_customer_id'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN asaas_customer_id VARCHAR(255);
    END IF;

    -- pix_copy_paste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'pix_copy_paste'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN pix_copy_paste TEXT;
    END IF;

    -- invoice_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'invoice_url'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN invoice_url TEXT;
    END IF;

    -- reminder_sent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'reminder_sent'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
    END IF;

    -- overdue_notification_sent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'overdue_notification_sent'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN overdue_notification_sent BOOLEAN DEFAULT FALSE;
    END IF;

    -- updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'asaas_payments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.asaas_payments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Adicionar índices para asaas_payments
CREATE INDEX IF NOT EXISTS idx_asaas_payments_asaas_payment_id ON public.asaas_payments(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_status ON public.asaas_payments(status);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_due_date ON public.asaas_payments(due_date);

-- Adicionar colunas aos eventos se não existirem
DO $$ 
BEGIN
    -- reminder_sent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'eventos' 
        AND column_name = 'reminder_sent'
    ) THEN
        ALTER TABLE public.eventos ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Adicionar colunas aos alunos_treinos se não existirem
DO $$ 
BEGIN
    -- expiration_notified
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alunos_treinos' 
        AND column_name = 'expiration_notified'
    ) THEN
        ALTER TABLE public.alunos_treinos ADD COLUMN expiration_notified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Criar tabela de mensagens se não existir
CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_sender_id ON public.mensagens(sender_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_recipient_id ON public.mensagens(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON public.mensagens(created_at DESC);

-- Criar tabela de recurring_charges se não existir
CREATE TABLE IF NOT EXISTS public.recurring_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    value DECIMAL(10, 2) NOT NULL,
    billing_type VARCHAR(50) NOT NULL DEFAULT 'BOLETO',
    due_day INT NOT NULL DEFAULT 10, -- Dia do mês
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    last_charge_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_charges_aluno_id ON public.recurring_charges(aluno_id);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_active ON public.recurring_charges(active);
