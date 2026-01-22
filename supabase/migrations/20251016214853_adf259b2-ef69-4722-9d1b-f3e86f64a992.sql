-- Criar tabela de eventos da agenda
CREATE TABLE public.agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento DATE NOT NULL,
  hora_evento TIME,
  tipo TEXT NOT NULL CHECK (tipo IN ('retorno', 'ajuste_dieta', 'alteracao_treino', 'avaliacao', 'outro')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta')),
  notificacao_enviada BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Coaches podem ver seus eventos"
  ON public.agenda_eventos
  FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar eventos"
  ON public.agenda_eventos
  FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus eventos"
  ON public.agenda_eventos
  FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus eventos"
  ON public.agenda_eventos
  FOR DELETE
  USING (auth.uid() = coach_id);

-- Trigger para updated_at
CREATE TRIGGER update_agenda_eventos_updated_at
  BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Índices para performance
CREATE INDEX idx_agenda_eventos_coach_id ON public.agenda_eventos(coach_id);
CREATE INDEX idx_agenda_eventos_aluno_id ON public.agenda_eventos(aluno_id);
CREATE INDEX idx_agenda_eventos_data ON public.agenda_eventos(data_evento);
CREATE INDEX idx_agenda_eventos_status ON public.agenda_eventos(status);