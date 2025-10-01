-- Limpar todas as políticas conflitantes e manter apenas acesso público temporário

-- Remover todas as políticas de coach que estão conflitando
DROP POLICY IF EXISTS "Coaches can create diets for their students" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can view diets of their students" ON public.dietas;
DROP POLICY IF EXISTS "Students can view their own diets" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can update diets of their students" ON public.dietas;
DROP POLICY IF EXISTS "Coaches can delete diets of their students" ON public.dietas;

-- Remover políticas de coach para itens_dieta
DROP POLICY IF EXISTS "Coaches can create diet items for their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can view diet items of their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Students can view their own diet items" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can update diet items of their students" ON public.itens_dieta;
DROP POLICY IF EXISTS "Coaches can delete diet items of their students" ON public.itens_dieta;

-- As políticas temporárias públicas já existem e estão funcionando
-- Não precisa recriar elas