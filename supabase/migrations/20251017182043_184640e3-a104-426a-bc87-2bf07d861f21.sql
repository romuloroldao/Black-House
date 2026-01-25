-- Criar tabela de templates de relatórios
CREATE TABLE public.relatorio_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  campos JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de relatórios
CREATE TABLE public.relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.relatorio_templates(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  metricas JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'visualizado')),
  enviado_em TIMESTAMPTZ,
  visualizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de feedbacks dos alunos nos relatórios
CREATE TABLE public.relatorio_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES public.relatorios(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de mídias dos relatórios
CREATE TABLE public.relatorio_midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id UUID NOT NULL REFERENCES public.relatorios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video')),
  url TEXT NOT NULL,
  legenda TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.relatorio_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_midias ENABLE ROW LEVEL SECURITY;

-- Políticas para relatorio_templates
CREATE POLICY "Coaches podem criar templates" ON public.relatorio_templates
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem ver seus templates" ON public.relatorio_templates
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus templates" ON public.relatorio_templates
  FOR UPDATE USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus templates" ON public.relatorio_templates
  FOR DELETE USING (auth.uid() = coach_id);

-- Políticas para relatorios
CREATE POLICY "Coaches podem criar relatórios" ON public.relatorios
  FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem ver seus relatórios" ON public.relatorios
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Alunos podem ver seus relatórios enviados" ON public.relatorios
  FOR SELECT USING (
    aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email')) 
    AND status IN ('enviado', 'visualizado')
  );

CREATE POLICY "Coaches podem atualizar seus relatórios" ON public.relatorios
  FOR UPDATE USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus relatórios" ON public.relatorios
  FOR DELETE USING (auth.uid() = coach_id);

-- Políticas para relatorio_feedbacks
CREATE POLICY "Alunos podem criar feedbacks nos seus relatórios" ON public.relatorio_feedbacks
  FOR INSERT WITH CHECK (
    aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY "Coaches podem ver feedbacks dos relatórios dos seus alunos" ON public.relatorio_feedbacks
  FOR SELECT USING (
    relatorio_id IN (SELECT id FROM public.relatorios WHERE coach_id = auth.uid())
  );

CREATE POLICY "Alunos podem ver seus próprios feedbacks" ON public.relatorio_feedbacks
  FOR SELECT USING (
    aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  );

-- Políticas para relatorio_midias
CREATE POLICY "Coaches podem adicionar mídias aos seus relatórios" ON public.relatorio_midias
  FOR INSERT WITH CHECK (
    relatorio_id IN (SELECT id FROM public.relatorios WHERE coach_id = auth.uid())
  );

CREATE POLICY "Coaches podem ver mídias dos seus relatórios" ON public.relatorio_midias
  FOR SELECT USING (
    relatorio_id IN (SELECT id FROM public.relatorios WHERE coach_id = auth.uid())
  );

CREATE POLICY "Alunos podem ver mídias dos seus relatórios" ON public.relatorio_midias
  FOR SELECT USING (
    relatorio_id IN (
      SELECT id FROM public.relatorios 
      WHERE aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
      AND status IN ('enviado', 'visualizado')
    )
  );

CREATE POLICY "Coaches podem deletar mídias dos seus relatórios" ON public.relatorio_midias
  FOR DELETE USING (
    relatorio_id IN (SELECT id FROM public.relatorios WHERE coach_id = auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_relatorio_templates_updated_at
  BEFORE UPDATE ON public.relatorio_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_relatorios_updated_at
  BEFORE UPDATE ON public.relatorios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();