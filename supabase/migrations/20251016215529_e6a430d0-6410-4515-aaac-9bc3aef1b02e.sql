-- Tabela para armazenar clientes Asaas vinculados aos alunos
CREATE TABLE IF NOT EXISTS public.asaas_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  asaas_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar cobranças/pagamentos
CREATE TABLE IF NOT EXISTS public.asaas_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  asaas_payment_id TEXT NOT NULL UNIQUE,
  asaas_customer_id TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  description TEXT,
  billing_type TEXT NOT NULL, -- BOLETO, CREDIT_CARD, PIX, UNDEFINED
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc
  due_date DATE NOT NULL,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar configuração da API Asaas por coach
CREATE TABLE IF NOT EXISTS public.asaas_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL UNIQUE,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_asaas_customers_aluno ON public.asaas_customers(aluno_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_coach ON public.asaas_payments(coach_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_aluno ON public.asaas_payments(aluno_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_status ON public.asaas_payments(status);
CREATE INDEX IF NOT EXISTS idx_asaas_config_coach ON public.asaas_config(coach_id);

-- RLS Policies
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;

-- Policies para asaas_customers
CREATE POLICY "Coaches podem ver customers de seus alunos"
  ON public.asaas_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = asaas_customers.aluno_id
      AND alunos.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches podem criar customers para seus alunos"
  ON public.asaas_customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = asaas_customers.aluno_id
      AND alunos.coach_id = auth.uid()
    )
  );

-- Policies para asaas_payments
CREATE POLICY "Coaches podem ver seus pagamentos"
  ON public.asaas_payments FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar pagamentos"
  ON public.asaas_payments FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus pagamentos"
  ON public.asaas_payments FOR UPDATE
  USING (auth.uid() = coach_id);

-- Policies para asaas_config
CREATE POLICY "Coaches podem ver sua config"
  ON public.asaas_config FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar sua config"
  ON public.asaas_config FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar sua config"
  ON public.asaas_config FOR UPDATE
  USING (auth.uid() = coach_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_asaas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_asaas_customers_updated_at
  BEFORE UPDATE ON public.asaas_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_asaas_updated_at();

CREATE TRIGGER update_asaas_payments_updated_at
  BEFORE UPDATE ON public.asaas_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_asaas_updated_at();

CREATE TRIGGER update_asaas_config_updated_at
  BEFORE UPDATE ON public.asaas_config
  FOR EACH ROW
  EXECUTE FUNCTION update_asaas_updated_at();