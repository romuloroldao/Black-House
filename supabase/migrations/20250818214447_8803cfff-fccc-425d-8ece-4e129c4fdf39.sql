-- Temporarily allow public access to view alunos for development
-- This should be replaced with proper authentication later

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Coaches can view their students" ON public.alunos;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.alunos;

-- Create temporary public read access for alunos
CREATE POLICY "Temporary public access to view alunos" ON public.alunos
FOR SELECT 
TO public
USING (true);

-- Also allow public access to create alunos for testing
DROP POLICY IF EXISTS "Coaches can create student profiles" ON public.alunos;

CREATE POLICY "Temporary public access to create alunos" ON public.alunos
FOR INSERT 
TO public
WITH CHECK (true);

-- Allow public access to update alunos for testing
DROP POLICY IF EXISTS "Coaches can update their students" ON public.alunos;
DROP POLICY IF EXISTS "Students can update their own profile" ON public.alunos;

CREATE POLICY "Temporary public access to update alunos" ON public.alunos
FOR UPDATE 
TO public
USING (true);