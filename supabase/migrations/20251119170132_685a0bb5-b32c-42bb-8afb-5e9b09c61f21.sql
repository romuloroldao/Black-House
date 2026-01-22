-- Criar tabela para check-ins semanais
CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Nutrição e dieta
  beliscou_fora_plano TEXT NOT NULL CHECK (beliscou_fora_plano IN ('prejudicando', 'comprometido')),
  seguiu_plano_nota INTEGER NOT NULL CHECK (seguiu_plano_nota BETWEEN 1 AND 5),
  apetite TEXT NOT NULL CHECK (apetite IN ('alto', 'normal', 'ruim')),
  
  -- Treino
  treinou_todas_sessoes BOOLEAN NOT NULL,
  desafiou_treinos BOOLEAN NOT NULL,
  fez_cardio BOOLEAN NOT NULL,
  
  -- Suplementação
  seguiu_suplementacao BOOLEAN NOT NULL,
  recursos_hormonais TEXT NOT NULL CHECK (recursos_hormonais IN ('sim', 'nao', 'nao_uso')),
  
  -- Hidratação e sol
  ingeriu_agua_minima BOOLEAN NOT NULL,
  exposicao_sol BOOLEAN NOT NULL,
  
  -- Saúde física
  pressao_arterial TEXT,
  glicemia TEXT,
  
  -- Sono
  media_horas_sono TEXT NOT NULL CHECK (media_horas_sono IN ('4-5', '5-6', '6-8')),
  dificuldade_adormecer BOOLEAN NOT NULL,
  acordou_noite TEXT,
  
  -- Mental e emocional
  estresse_semana BOOLEAN NOT NULL,
  lida_desafios TEXT NOT NULL CHECK (lida_desafios IN ('nao_lida_bem', 'as_vezes_abate', 'lida_bem')),
  convivio_familiar TEXT NOT NULL CHECK (convivio_familiar IN ('ruim', 'bom', 'otimo')),
  convivio_trabalho TEXT NOT NULL CHECK (convivio_trabalho IN ('ruim', 'bom', 'otimo')),
  postura_problemas TEXT NOT NULL CHECK (postura_problemas IN ('nao_sabe_resolver', 'resiliente')),
  higiene_sono BOOLEAN NOT NULL,
  autoestima INTEGER NOT NULL CHECK (autoestima BETWEEN 1 AND 5),
  
  -- Saúde digestiva
  media_evacuacoes TEXT NOT NULL CHECK (media_evacuacoes IN ('dias_sem', '1', '2', '3', 'mais_4')),
  formato_fezes TEXT NOT NULL CHECK (formato_fezes IN ('tipo1', 'tipo2', 'tipo3', 'tipo4', 'tipo5', 'tipo6', 'tipo7')),
  
  -- Observações
  nao_cumpriu_porque TEXT,
  
  status TEXT DEFAULT 'concluido'
);

-- Índices para performance
CREATE INDEX idx_weekly_checkins_aluno ON public.weekly_checkins(aluno_id);
CREATE INDEX idx_weekly_checkins_created ON public.weekly_checkins(created_at DESC);

-- RLS Policies
ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Alunos podem ver e criar seus próprios check-ins
CREATE POLICY "Alunos podem ver seus check-ins"
  ON public.weekly_checkins
  FOR SELECT
  USING (
    aluno_id IN (
      SELECT id FROM public.alunos 
      WHERE email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Alunos podem criar seus check-ins"
  ON public.weekly_checkins
  FOR INSERT
  WITH CHECK (
    aluno_id IN (
      SELECT id FROM public.alunos 
      WHERE email = (auth.jwt() ->> 'email')
    )
  );

-- Coaches podem ver check-ins de seus alunos
CREATE POLICY "Coaches podem ver check-ins de seus alunos"
  ON public.weekly_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.alunos 
      WHERE id = weekly_checkins.aluno_id 
      AND coach_id = auth.uid()
    )
  );

-- Criar tabela para lembretes de check-in
CREATE TABLE IF NOT EXISTS public.checkin_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  ultima_notificacao TIMESTAMP WITH TIME ZONE,
  proximo_lembrete TIMESTAMP WITH TIME ZONE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_checkin_reminders_proximo ON public.checkin_reminders(proximo_lembrete);

ALTER TABLE public.checkin_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema pode gerenciar lembretes"
  ON public.checkin_reminders
  FOR ALL
  USING (true)
  WITH CHECK (true);