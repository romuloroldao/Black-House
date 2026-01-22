-- Add RLS policies for user_roles table to allow coaches to manage roles

-- Policy: Coaches podem ver todos os papéis de usuários
CREATE POLICY "Coaches podem ver todos os papeis" 
ON public.user_roles 
FOR SELECT 
USING (public.is_coach(auth.uid()));

-- Policy: Coaches podem atualizar papéis de usuários
CREATE POLICY "Coaches podem atualizar papeis" 
ON public.user_roles 
FOR UPDATE 
USING (public.is_coach(auth.uid()));

-- Policy: Coaches podem inserir papéis
CREATE POLICY "Coaches podem inserir papeis" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.is_coach(auth.uid()));

-- Policy: Coaches podem deletar papéis
CREATE POLICY "Coaches podem deletar papeis" 
ON public.user_roles 
FOR DELETE 
USING (public.is_coach(auth.uid()));