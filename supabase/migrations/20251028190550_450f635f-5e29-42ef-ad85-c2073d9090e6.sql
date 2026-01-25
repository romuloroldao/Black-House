-- Criar tabela de turmas
CREATE TABLE public.turmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3b82f6',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de alunos em turmas
CREATE TABLE public.turmas_alunos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(turma_id, aluno_id)
);

-- Criar tabela de avisos
CREATE TABLE public.avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'individual',
  anexo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de destinatários de avisos
CREATE TABLE public.avisos_destinatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aviso_id UUID NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE,
  lido BOOLEAN NOT NULL DEFAULT false,
  lido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de eventos
CREATE TABLE public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60,
  recorrencia TEXT NOT NULL DEFAULT 'unica',
  recorrencia_config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'agendado',
  link_online TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de participantes de eventos
CREATE TABLE public.eventos_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  confirmado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evento_id, aluno_id)
);

-- Criar tabela de lembretes de eventos
CREATE TABLE public.lembretes_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo_lembrete TEXT NOT NULL,
  enviado BOOLEAN NOT NULL DEFAULT false,
  enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_eventos ENABLE ROW LEVEL SECURITY;

-- RLS Policies para turmas
CREATE POLICY "Coaches podem ver suas turmas"
  ON public.turmas FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar turmas"
  ON public.turmas FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas turmas"
  ON public.turmas FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar suas turmas"
  ON public.turmas FOR DELETE
  USING (auth.uid() = coach_id);

-- RLS Policies para turmas_alunos
CREATE POLICY "Coaches podem ver membros de suas turmas"
  ON public.turmas_alunos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.turmas t 
    WHERE t.id = turma_id AND t.coach_id = auth.uid()
  ));

CREATE POLICY "Alunos podem ver suas turmas"
  ON public.turmas_alunos FOR SELECT
  USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
  ));

CREATE POLICY "Coaches podem adicionar alunos às suas turmas"
  ON public.turmas_alunos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.turmas t 
    WHERE t.id = turma_id AND t.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches podem remover alunos de suas turmas"
  ON public.turmas_alunos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.turmas t 
    WHERE t.id = turma_id AND t.coach_id = auth.uid()
  ));

-- RLS Policies para avisos
CREATE POLICY "Coaches podem ver seus avisos"
  ON public.avisos FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar avisos"
  ON public.avisos FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus avisos"
  ON public.avisos FOR DELETE
  USING (auth.uid() = coach_id);

-- RLS Policies para avisos_destinatarios
CREATE POLICY "Coaches podem ver destinatários de seus avisos"
  ON public.avisos_destinatarios FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.avisos a 
    WHERE a.id = aviso_id AND a.coach_id = auth.uid()
  ));

CREATE POLICY "Alunos podem ver avisos destinados a eles"
  ON public.avisos_destinatarios FOR SELECT
  USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
  ) OR turma_id IN (
    SELECT turma_id FROM public.turmas_alunos ta 
    WHERE ta.aluno_id IN (
      SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Sistema pode criar destinatários"
  ON public.avisos_destinatarios FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Alunos podem atualizar status de leitura"
  ON public.avisos_destinatarios FOR UPDATE
  USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
  ));

-- RLS Policies para eventos
CREATE POLICY "Coaches podem ver seus eventos"
  ON public.eventos FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Alunos podem ver eventos das suas turmas"
  ON public.eventos FOR SELECT
  USING (turma_id IN (
    SELECT turma_id FROM public.turmas_alunos ta 
    WHERE ta.aluno_id IN (
      SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
    )
  ) OR id IN (
    SELECT evento_id FROM public.eventos_participantes ep
    WHERE ep.aluno_id IN (
      SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Coaches podem criar eventos"
  ON public.eventos FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus eventos"
  ON public.eventos FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus eventos"
  ON public.eventos FOR DELETE
  USING (auth.uid() = coach_id);

-- RLS Policies para eventos_participantes
CREATE POLICY "Coaches podem ver participantes de seus eventos"
  ON public.eventos_participantes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.eventos e 
    WHERE e.id = evento_id AND e.coach_id = auth.uid()
  ));

CREATE POLICY "Alunos podem ver seus eventos"
  ON public.eventos_participantes FOR SELECT
  USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
  ));

CREATE POLICY "Coaches podem adicionar participantes"
  ON public.eventos_participantes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.eventos e 
    WHERE e.id = evento_id AND e.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches podem remover participantes"
  ON public.eventos_participantes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.eventos e 
    WHERE e.id = evento_id AND e.coach_id = auth.uid()
  ));

CREATE POLICY "Alunos podem atualizar confirmação"
  ON public.eventos_participantes FOR UPDATE
  USING (aluno_id IN (
    SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')
  ));

-- RLS Policies para lembretes_eventos
CREATE POLICY "Sistema pode gerenciar lembretes"
  ON public.lembretes_eventos FOR ALL
  USING (true)
  WITH CHECK (true);

-- Criar índices para performance
CREATE INDEX idx_turmas_coach_id ON public.turmas(coach_id);
CREATE INDEX idx_turmas_alunos_turma_id ON public.turmas_alunos(turma_id);
CREATE INDEX idx_turmas_alunos_aluno_id ON public.turmas_alunos(aluno_id);
CREATE INDEX idx_avisos_coach_id ON public.avisos(coach_id);
CREATE INDEX idx_avisos_destinatarios_aviso_id ON public.avisos_destinatarios(aviso_id);
CREATE INDEX idx_avisos_destinatarios_aluno_id ON public.avisos_destinatarios(aluno_id);
CREATE INDEX idx_eventos_coach_id ON public.eventos(coach_id);
CREATE INDEX idx_eventos_turma_id ON public.eventos(turma_id);
CREATE INDEX idx_eventos_data_inicio ON public.eventos(data_inicio);
CREATE INDEX idx_eventos_participantes_evento_id ON public.eventos_participantes(evento_id);
CREATE INDEX idx_eventos_participantes_aluno_id ON public.eventos_participantes(aluno_id);
CREATE INDEX idx_lembretes_eventos_enviado ON public.lembretes_eventos(enviado) WHERE enviado = false;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_turmas_updated_at
  BEFORE UPDATE ON public.turmas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_eventos_updated_at
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();