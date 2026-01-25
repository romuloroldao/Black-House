-- Ajustar as políticas RLS para permitir que usuários autenticados criem dietas para qualquer aluno
-- (Ideal para aplicativos onde nutricionistas/treinadores criam dietas para clientes)

-- Remover política restritiva atual
DROP POLICY IF EXISTS "Users can create own diets" ON public.dietas;
DROP POLICY IF EXISTS "Users can view own diets" ON public.dietas;
DROP POLICY IF EXISTS "Users can update own diets" ON public.dietas;
DROP POLICY IF EXISTS "Users can delete own diets" ON public.dietas;

-- Criar políticas mais flexíveis para profissionais que gerenciam dietas de clientes
CREATE POLICY "Authenticated users can create diets for any student" 
ON public.dietas 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view all diets" 
ON public.dietas 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update all diets" 
ON public.dietas 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete all diets" 
ON public.dietas 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Ajustar políticas dos itens de dieta para serem consistentes
DROP POLICY IF EXISTS "Users can create own diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Users can view own diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Users can update own diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Users can delete own diet items" ON public.itens_dieta;

CREATE POLICY "Authenticated users can create diet items" 
ON public.itens_dieta 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view diet items" 
ON public.itens_dieta 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update diet items" 
ON public.itens_dieta 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete diet items" 
ON public.itens_dieta 
FOR DELETE 
USING (auth.uid() IS NOT NULL);