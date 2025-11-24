-- Criar tabela de fármacos/medicações para dietas
CREATE TABLE IF NOT EXISTS public.dieta_farmacos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dieta_id UUID NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dosagem TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.dieta_farmacos ENABLE ROW LEVEL SECURITY;

-- Coaches podem ver fármacos das dietas que criaram
CREATE POLICY "Coaches podem ver farmacos de suas dietas"
ON public.dieta_farmacos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dietas d
    WHERE d.id = dieta_farmacos.dieta_id
    AND d.aluno_id IN (
      SELECT a.id FROM public.alunos a
      WHERE a.coach_id = auth.uid()
    )
  )
);

-- Coaches podem inserir fármacos em suas dietas
CREATE POLICY "Coaches podem inserir farmacos em suas dietas"
ON public.dieta_farmacos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dietas d
    WHERE d.id = dieta_farmacos.dieta_id
    AND d.aluno_id IN (
      SELECT a.id FROM public.alunos a
      WHERE a.coach_id = auth.uid()
    )
  )
);

-- Coaches podem atualizar fármacos de suas dietas
CREATE POLICY "Coaches podem atualizar farmacos de suas dietas"
ON public.dieta_farmacos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dietas d
    WHERE d.id = dieta_farmacos.dieta_id
    AND d.aluno_id IN (
      SELECT a.id FROM public.alunos a
      WHERE a.coach_id = auth.uid()
    )
  )
);

-- Coaches podem deletar fármacos de suas dietas
CREATE POLICY "Coaches podem deletar farmacos de suas dietas"
ON public.dieta_farmacos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dietas d
    WHERE d.id = dieta_farmacos.dieta_id
    AND d.aluno_id IN (
      SELECT a.id FROM public.alunos a
      WHERE a.coach_id = auth.uid()
    )
  )
);

-- Alunos podem ver fármacos de suas próprias dietas
CREATE POLICY "Alunos podem ver farmacos de suas dietas"
ON public.dieta_farmacos
FOR SELECT
TO authenticated
USING (
  dieta_id IN (
    SELECT d.id FROM public.dietas d
    WHERE d.aluno_id IN (
      SELECT a.id FROM public.alunos a
      WHERE a.email = (auth.jwt() ->> 'email'::text)
    )
  )
);