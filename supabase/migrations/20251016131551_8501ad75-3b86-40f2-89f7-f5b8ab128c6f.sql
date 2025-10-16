-- Drop existing foreign key constraint
ALTER TABLE public.dietas 
DROP CONSTRAINT IF EXISTS dietas_aluno_id_fkey;

-- Add new foreign key constraint with CASCADE delete
ALTER TABLE public.dietas 
ADD CONSTRAINT dietas_aluno_id_fkey 
FOREIGN KEY (aluno_id) 
REFERENCES public.alunos(id) 
ON DELETE CASCADE;