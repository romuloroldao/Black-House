-- Criar sistema de roles para Coach e Aluno
CREATE TYPE public.user_role AS ENUM ('coach', 'aluno');

-- Criar tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS na tabela de roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS user_role AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Criar função para verificar se usuário é coach
CREATE OR REPLACE FUNCTION public.is_coach(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'coach'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Adicionar coluna coach_id na tabela alunos para vincular aluno ao coach
ALTER TABLE public.alunos ADD COLUMN coach_id UUID REFERENCES auth.users(id);

-- Políticas RLS para user_roles
CREATE POLICY "Users can view their own role" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view student roles" 
ON public.user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE coach_id = auth.uid() 
    AND id = (SELECT user_id FROM public.user_roles ur WHERE ur.user_id = user_roles.user_id)
  )
);

-- Atualizar políticas RLS para dietas
DROP POLICY IF EXISTS "Authenticated users can create diets for any student" ON public.dietas;
DROP POLICY IF EXISTS "Authenticated users can view all diets" ON public.dietas;
DROP POLICY IF EXISTS "Authenticated users can update all diets" ON public.dietas;
DROP POLICY IF EXISTS "Authenticated users can delete all diets" ON public.dietas;

-- Políticas para dietas: apenas coaches podem criar/editar
CREATE POLICY "Coaches can create diets for their students" 
ON public.dietas 
FOR INSERT 
WITH CHECK (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE id = aluno_id AND coach_id = auth.uid()
  )
);

CREATE POLICY "Coaches can view diets of their students" 
ON public.dietas 
FOR SELECT 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE id = aluno_id AND coach_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own diets" 
ON public.dietas 
FOR SELECT 
USING (
  auth.uid() = aluno_id AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'aluno'
  )
);

CREATE POLICY "Coaches can update diets of their students" 
ON public.dietas 
FOR UPDATE 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE id = aluno_id AND coach_id = auth.uid()
  )
);

CREATE POLICY "Coaches can delete diets of their students" 
ON public.dietas 
FOR DELETE 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.alunos 
    WHERE id = aluno_id AND coach_id = auth.uid()
  )
);

-- Atualizar políticas para itens_dieta
DROP POLICY IF EXISTS "Authenticated users can create diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Authenticated users can view diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Authenticated users can update diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Authenticated users can delete diet items" ON public.itens_dieta;

-- Políticas para itens_dieta: apenas coaches podem criar/editar
CREATE POLICY "Coaches can create diet items for their students" 
ON public.itens_dieta 
FOR INSERT 
WITH CHECK (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.dietas d
    JOIN public.alunos a ON d.aluno_id = a.id
    WHERE d.id = dieta_id AND a.coach_id = auth.uid()
  )
);

CREATE POLICY "Coaches can view diet items of their students" 
ON public.itens_dieta 
FOR SELECT 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.dietas d
    JOIN public.alunos a ON d.aluno_id = a.id
    WHERE d.id = dieta_id AND a.coach_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own diet items" 
ON public.itens_dieta 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas d
    WHERE d.id = dieta_id AND d.aluno_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'aluno'
    )
  )
);

CREATE POLICY "Coaches can update diet items of their students" 
ON public.itens_dieta 
FOR UPDATE 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.dietas d
    JOIN public.alunos a ON d.aluno_id = a.id
    WHERE d.id = dieta_id AND a.coach_id = auth.uid()
  )
);

CREATE POLICY "Coaches can delete diet items of their students" 
ON public.itens_dieta 
FOR DELETE 
USING (
  public.is_coach() AND 
  EXISTS (
    SELECT 1 FROM public.dietas d
    JOIN public.alunos a ON d.aluno_id = a.id
    WHERE d.id = dieta_id AND a.coach_id = auth.uid()
  )
);

-- Atualizar políticas para alunos
DROP POLICY IF EXISTS "Anyone can view alunos" ON public.alunos;
DROP POLICY IF EXISTS "Students can create own profile" ON public.alunos;
DROP POLICY IF EXISTS "Students can update own profile" ON public.alunos;
DROP POLICY IF EXISTS "Students can view own profile" ON public.alunos;
DROP POLICY IF EXISTS "Trainers can update their students" ON public.alunos;
DROP POLICY IF EXISTS "Trainers can view their students" ON public.alunos;

CREATE POLICY "Coaches can view their students" 
ON public.alunos 
FOR SELECT 
USING (coach_id = auth.uid() AND public.is_coach());

CREATE POLICY "Students can view their own profile" 
ON public.alunos 
FOR SELECT 
USING (
  id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'aluno'
  )
);

CREATE POLICY "Coaches can create student profiles" 
ON public.alunos 
FOR INSERT 
WITH CHECK (coach_id = auth.uid() AND public.is_coach());

CREATE POLICY "Coaches can update their students" 
ON public.alunos 
FOR UPDATE 
USING (coach_id = auth.uid() AND public.is_coach());

CREATE POLICY "Students can update their own profile" 
ON public.alunos 
FOR UPDATE 
USING (
  id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'aluno'
  )
);