-- Add DELETE policy for alunos table
CREATE POLICY "Temporary public access to delete alunos" 
ON public.alunos 
FOR DELETE 
USING (true);