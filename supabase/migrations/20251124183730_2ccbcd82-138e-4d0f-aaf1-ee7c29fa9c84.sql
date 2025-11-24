-- Permitir que coaches insiram novos alimentos
CREATE POLICY "Coaches podem inserir alimentos"
ON public.alimentos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir que coaches atualizem alimentos que eles criaram
CREATE POLICY "Coaches podem atualizar seus alimentos"
ON public.alimentos
FOR UPDATE
TO authenticated
USING (autor = auth.uid()::text);

-- Permitir que coaches deletem alimentos que eles criaram
CREATE POLICY "Coaches podem deletar seus alimentos"
ON public.alimentos
FOR DELETE
TO authenticated
USING (autor = auth.uid()::text);