-- Temporariamente permitir acesso público à tabela dietas para desenvolvimento
-- Isto deve ser substituído por autenticação adequada mais tarde

-- Remover políticas existentes restritivas
DROP POLICY IF EXISTS "Coaches can create diets for their students" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can view diets of their students" ON public.dietas;
DROP POLICY IF EXISTS "Students can view their own diets" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can update diets of their students" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can delete diets of their students" ON public.dietas;

-- Criar acesso público temporário para dietas
CREATE POLICY "Temporary public access to create dietas" ON public.dietas
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Temporary public access to view dietas" ON public.dietas
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Temporary public access to update dietas" ON public.dietas
FOR UPDATE 
TO public
USING (true);

CREATE POLICY "Temporary public access to delete dietas" ON public.dietas
FOR DELETE 
TO public
USING (true);

-- Também ajustar as políticas para itens_dieta
DROP POLICY IF EXISTS "Coaches can create diet items for their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can view diet items of their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Students can view their own diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can update diet items of their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can delete diet items of their students" ON public.itens_dieta;

CREATE POLICY "Temporary public access to create itens_dieta" ON public.itens_dieta
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Temporary public access to view itens_dieta" ON public.itens_dieta
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Temporary public access to update itens_dieta" ON public.itens_dieta
FOR UPDATE 
TO public
USING (true);

CREATE POLICY "Temporary public access to delete itens_dieta" ON public.itens_dieta
FOR DELETE 
TO public
USING (true);