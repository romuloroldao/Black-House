-- Enable Row Level Security on dietas table
ALTER TABLE public.dietas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own diets
CREATE POLICY "Users can view own diets" 
ON public.dietas 
FOR SELECT 
USING (auth.uid() = aluno_id);

-- Policy: Users can create their own diets
CREATE POLICY "Users can create own diets" 
ON public.dietas 
FOR INSERT 
WITH CHECK (auth.uid() = aluno_id);

-- Policy: Users can update their own diets
CREATE POLICY "Users can update own diets" 
ON public.dietas 
FOR UPDATE 
USING (auth.uid() = aluno_id);

-- Policy: Users can delete their own diets
CREATE POLICY "Users can delete own diets" 
ON public.dietas 
FOR DELETE 
USING (auth.uid() = aluno_id);

-- Enable Row Level Security on itens_dieta table
ALTER TABLE public.itens_dieta ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view diet items for their own diets
CREATE POLICY "Users can view own diet items" 
ON public.itens_dieta 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.id = itens_dieta.dieta_id 
    AND dietas.aluno_id = auth.uid()
  )
);

-- Policy: Users can create diet items for their own diets
CREATE POLICY "Users can create own diet items" 
ON public.itens_dieta 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.id = itens_dieta.dieta_id 
    AND dietas.aluno_id = auth.uid()
  )
);

-- Policy: Users can update diet items for their own diets
CREATE POLICY "Users can update own diet items" 
ON public.itens_dieta 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.id = itens_dieta.dieta_id 
    AND dietas.aluno_id = auth.uid()
  )
);

-- Policy: Users can delete diet items for their own diets
CREATE POLICY "Users can delete own diet items" 
ON public.itens_dieta 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.id = itens_dieta.dieta_id 
    AND dietas.aluno_id = auth.uid()
  )
);

-- Enable Row Level Security on alimentos table
ALTER TABLE public.alimentos ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view food items
CREATE POLICY "Authenticated users can view alimentos" 
ON public.alimentos 
FOR SELECT 
TO authenticated 
USING (true);