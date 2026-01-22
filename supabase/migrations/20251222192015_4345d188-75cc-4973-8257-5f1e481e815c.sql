-- Create coach_profiles table for additional coach information
CREATE TABLE public.coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_completo text,
  bio text,
  especialidades text[] DEFAULT '{}',
  conquistas jsonb DEFAULT '[]',
  anos_experiencia integer DEFAULT 0,
  total_alunos_acompanhados integer DEFAULT 0,
  principais_resultados text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their own profile
CREATE POLICY "Coaches can view their own profile"
ON public.coach_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Coaches can insert their own profile"
ON public.coach_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can update their own profile"
ON public.coach_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Students can view their coach's profile
CREATE POLICY "Students can view their coach profile"
ON public.coach_profiles
FOR SELECT
USING (
  user_id IN (
    SELECT coach_id FROM public.alunos 
    WHERE email = (auth.jwt() ->> 'email'::text)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_coach_profiles_updated_at
BEFORE UPDATE ON public.coach_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();