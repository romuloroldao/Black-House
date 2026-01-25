-- Criar tabela de planos de pagamento
CREATE TABLE public.planos_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  frequencia TEXT NOT NULL, -- mensal, trimestral, semestral, anual
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.planos_pagamento ENABLE ROW LEVEL SECURITY;

-- Policies para coaches
CREATE POLICY "Coaches podem ver seus planos"
  ON public.planos_pagamento
  FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar planos"
  ON public.planos_pagamento
  FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus planos"
  ON public.planos_pagamento
  FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus planos"
  ON public.planos_pagamento
  FOR DELETE
  USING (auth.uid() = coach_id);

-- Trigger para updated_at
CREATE TRIGGER update_planos_pagamento_updated_at
  BEFORE UPDATE ON public.planos_pagamento
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();