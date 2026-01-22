-- Criar função para verificar se o usuário é um aluno baseado no email
CREATE OR REPLACE FUNCTION public.get_aluno_id_by_email(user_email text DEFAULT (auth.jwt() ->> 'email'))
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.alunos WHERE email = user_email LIMIT 1;
$$;

-- Atualizar RLS policies para alunos visualizarem suas próprias informações
DROP POLICY IF EXISTS "Alunos podem ver suas informações" ON public.alunos;
CREATE POLICY "Alunos podem ver suas informações"
ON public.alunos
FOR SELECT
USING (email = (auth.jwt() ->> 'email') OR coach_id = auth.uid());

DROP POLICY IF EXISTS "Alunos podem atualizar suas informações" ON public.alunos;
CREATE POLICY "Alunos podem atualizar suas informações"
ON public.alunos
FOR UPDATE
USING (email = (auth.jwt() ->> 'email'));

-- Permitir alunos verem seus treinos atribuídos
DROP POLICY IF EXISTS "Alunos podem ver seus treinos" ON public.alunos_treinos;
CREATE POLICY "Alunos podem ver seus treinos"
ON public.alunos_treinos
FOR SELECT
USING (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  OR EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.id = alunos_treinos.aluno_id
    AND a.coach_id = auth.uid()
  )
);

-- Permitir alunos verem os treinos completos
DROP POLICY IF EXISTS "Alunos podem ver detalhes dos treinos" ON public.treinos;
CREATE POLICY "Alunos podem ver detalhes dos treinos"
ON public.treinos
FOR SELECT
USING (
  coach_id = auth.uid()
  OR id IN (
    SELECT treino_id FROM public.alunos_treinos at
    JOIN public.alunos a ON a.id = at.aluno_id
    WHERE a.email = (auth.jwt() ->> 'email')
  )
);

-- Permitir alunos verem suas dietas
DROP POLICY IF EXISTS "Alunos podem ver suas dietas" ON public.dietas;
CREATE POLICY "Alunos podem ver suas dietas"
ON public.dietas
FOR SELECT
USING (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos verem itens de suas dietas
DROP POLICY IF EXISTS "Alunos podem ver itens de suas dietas" ON public.itens_dieta;
CREATE POLICY "Alunos podem ver itens de suas dietas"
ON public.itens_dieta
FOR SELECT
USING (
  dieta_id IN (
    SELECT d.id FROM public.dietas d
    JOIN public.alunos a ON a.id = d.aluno_id
    WHERE a.email = (auth.jwt() ->> 'email')
  )
);

-- Permitir alunos verem vídeos do seu coach
DROP POLICY IF EXISTS "Alunos podem ver vídeos do coach" ON public.videos;
CREATE POLICY "Alunos podem ver vídeos do coach"
ON public.videos
FOR SELECT
USING (
  coach_id = auth.uid()
  OR (
    coach_id IN (SELECT coach_id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
    AND visibilidade IN ('todos', 'alunos')
  )
);

-- Permitir alunos verem suas conversas
DROP POLICY IF EXISTS "Alunos podem ver suas conversas" ON public.conversas;
CREATE POLICY "Alunos podem ver suas conversas"
ON public.conversas
FOR SELECT
USING (
  coach_id = auth.uid()
  OR aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos criarem conversas
DROP POLICY IF EXISTS "Alunos podem criar conversas" ON public.conversas;
CREATE POLICY "Alunos podem criar conversas"
ON public.conversas
FOR INSERT
WITH CHECK (
  coach_id = auth.uid()
  OR aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos atualizarem conversas
DROP POLICY IF EXISTS "Alunos podem atualizar conversas" ON public.conversas;
CREATE POLICY "Alunos podem atualizar conversas"
ON public.conversas
FOR UPDATE
USING (
  coach_id = auth.uid()
  OR aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos verem mensagens de suas conversas
DROP POLICY IF EXISTS "Alunos podem ver mensagens" ON public.mensagens;
CREATE POLICY "Alunos podem ver mensagens"
ON public.mensagens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversas
    WHERE conversas.id = mensagens.conversa_id
    AND (
      conversas.coach_id = auth.uid()
      OR conversas.aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
    )
  )
);

-- Permitir alunos criarem mensagens em suas conversas
DROP POLICY IF EXISTS "Alunos podem criar mensagens" ON public.mensagens;
CREATE POLICY "Alunos podem criar mensagens"
ON public.mensagens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversas
    WHERE conversas.id = mensagens.conversa_id
    AND (
      conversas.coach_id = auth.uid()
      OR conversas.aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
    )
  )
  AND (
    remetente_id = auth.uid()
    OR remetente_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  )
);

-- Permitir alunos verem suas fotos
DROP POLICY IF EXISTS "Alunos podem ver suas fotos" ON public.fotos_alunos;
CREATE POLICY "Alunos podem ver suas fotos"
ON public.fotos_alunos
FOR SELECT
USING (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  OR EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.id = fotos_alunos.aluno_id
    AND a.coach_id = auth.uid()
  )
);

-- Permitir alunos verem seus pagamentos
DROP POLICY IF EXISTS "Alunos podem ver seus pagamentos" ON public.asaas_payments;
CREATE POLICY "Alunos podem ver seus pagamentos"
ON public.asaas_payments
FOR SELECT
USING (
  coach_id = auth.uid()
  OR aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos verem eventos da agenda
DROP POLICY IF EXISTS "Alunos podem ver seus eventos" ON public.agenda_eventos;
CREATE POLICY "Alunos podem ver seus eventos"
ON public.agenda_eventos
FOR SELECT
USING (
  coach_id = auth.uid()
  OR aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
);

-- Permitir alunos verem feedbacks sobre eles
DROP POLICY IF EXISTS "Alunos podem ver seus feedbacks" ON public.feedbacks_alunos;
CREATE POLICY "Alunos podem ver seus feedbacks"
ON public.feedbacks_alunos
FOR SELECT
USING (
  aluno_id IN (SELECT id FROM public.alunos WHERE email = (auth.jwt() ->> 'email'))
  OR coach_id = auth.uid()
);