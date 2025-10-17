-- Tabela de configurações de planos de pagamento
CREATE TABLE public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  descricao TEXT,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  frequencia TEXT NOT NULL CHECK (frequencia IN ('mensal', 'trimestral', 'semestral', 'anual')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de exceções financeiras (acordos especiais)
CREATE TABLE public.financial_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('isento', 'desconto', 'acordo_pagamento', 'bolsa')),
  valor_desconto NUMERIC(10,2),
  percentual_desconto NUMERIC(5,2),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de despesas/saídas
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  categoria TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento TEXT,
  observacoes TEXT,
  recorrente BOOLEAN DEFAULT false,
  frequencia_recorrencia TEXT CHECK (frequencia_recorrencia IN ('mensal', 'trimestral', 'semestral', 'anual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configuração de cobranças recorrentes
CREATE TABLE public.recurring_charges_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  payment_plan_id UUID REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  valor_customizado NUMERIC(10,2),
  dia_vencimento_customizado INTEGER CHECK (dia_vencimento_customizado >= 1 AND dia_vencimento_customizado <= 31),
  ativo BOOLEAN NOT NULL DEFAULT true,
  enviar_lembrete BOOLEAN DEFAULT true,
  dias_antecedencia_lembrete INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, aluno_id)
);

-- RLS Policies para payment_plans
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches podem ver seus planos"
  ON public.payment_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar planos"
  ON public.payment_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus planos"
  ON public.payment_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus planos"
  ON public.payment_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- RLS Policies para financial_exceptions
ALTER TABLE public.financial_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches podem ver suas exceções"
  ON public.financial_exceptions FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar exceções"
  ON public.financial_exceptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas exceções"
  ON public.financial_exceptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar suas exceções"
  ON public.financial_exceptions FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- RLS Policies para expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches podem ver suas despesas"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar despesas"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas despesas"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar suas despesas"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- RLS Policies para recurring_charges_config
ALTER TABLE public.recurring_charges_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches podem ver suas configurações"
  ON public.recurring_charges_config FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar configurações"
  ON public.recurring_charges_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas configurações"
  ON public.recurring_charges_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar suas configurações"
  ON public.recurring_charges_config FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Triggers para updated_at
CREATE TRIGGER update_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_financial_exceptions_updated_at
  BEFORE UPDATE ON public.financial_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_recurring_charges_config_updated_at
  BEFORE UPDATE ON public.recurring_charges_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();