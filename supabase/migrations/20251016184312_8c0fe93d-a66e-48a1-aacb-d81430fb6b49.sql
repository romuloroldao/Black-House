-- Criar tabela de conversas
CREATE TABLE IF NOT EXISTS public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  aluno_id UUID NOT NULL,
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coach_id, aluno_id)
);

-- Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL,
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas para conversas
CREATE POLICY "Coaches podem ver suas conversas"
  ON public.conversas FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar conversas"
  ON public.conversas FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas conversas"
  ON public.conversas FOR UPDATE
  USING (auth.uid() = coach_id);

-- Políticas para mensagens
CREATE POLICY "Usuários podem ver mensagens de suas conversas"
  ON public.mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversas
      WHERE conversas.id = mensagens.conversa_id
      AND (conversas.coach_id = auth.uid() OR conversas.aluno_id = auth.uid())
    )
  );

CREATE POLICY "Usuários podem criar mensagens em suas conversas"
  ON public.mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversas
      WHERE conversas.id = mensagens.conversa_id
      AND (conversas.coach_id = auth.uid() OR conversas.aluno_id = auth.uid())
    )
    AND auth.uid() = remetente_id
  );

CREATE POLICY "Usuários podem atualizar mensagens em suas conversas"
  ON public.mensagens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversas
      WHERE conversas.id = mensagens.conversa_id
      AND (conversas.coach_id = auth.uid() OR conversas.aluno_id = auth.uid())
    )
  );

-- Trigger para atualizar updated_at em conversas
CREATE TRIGGER update_conversas_updated_at
  BEFORE UPDATE ON public.conversas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER TABLE public.mensagens REPLICA IDENTITY FULL;