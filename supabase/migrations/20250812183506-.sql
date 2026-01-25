-- Enable Row Level Security on alunos table
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own profile
CREATE POLICY "Students can view own profile" 
ON public.alunos 
FOR SELECT 
USING (auth.uid() = id);

-- Policy: Students can update their own profile
CREATE POLICY "Students can update own profile" 
ON public.alunos 
FOR UPDATE 
USING (auth.uid() = id);

-- Policy: Students can insert their own profile (self-registration)
CREATE POLICY "Students can create own profile" 
ON public.alunos 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Policy: Personal trainers can view students they have diets for
CREATE POLICY "Trainers can view their students" 
ON public.alunos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.aluno_id = alunos.id 
    AND dietas.created_at IS NOT NULL
  )
);

-- Policy: Personal trainers can update students they work with
CREATE POLICY "Trainers can update their students" 
ON public.alunos 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.dietas 
    WHERE dietas.aluno_id = alunos.id 
    AND dietas.created_at IS NOT NULL
  )
);