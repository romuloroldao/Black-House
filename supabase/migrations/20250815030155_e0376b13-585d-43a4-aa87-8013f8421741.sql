-- Allow public access to view alimentos (food items) since they are general data needed for diet creation
DROP POLICY IF EXISTS "Authenticated users can view alimentos" ON public.alimentos;

CREATE POLICY "Anyone can view alimentos" 
ON public.alimentos 
FOR SELECT 
USING (true);

-- Allow public access to view alunos for diet creation 
-- (Note: In production, you may want to restrict this and implement proper authentication)
CREATE POLICY "Anyone can view alunos" 
ON public.alunos 
FOR SELECT 
USING (true);