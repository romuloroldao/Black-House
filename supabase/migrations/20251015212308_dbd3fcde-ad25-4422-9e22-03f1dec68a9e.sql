-- Criar tabela de treinos
CREATE TABLE public.treinos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  duracao integer NOT NULL DEFAULT 60,
  dificuldade text NOT NULL CHECK (dificuldade IN ('Iniciante', 'Intermediário', 'Avançado')),
  categoria text NOT NULL,
  num_exercicios integer DEFAULT 0,
  is_template boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela de vídeos do YouTube
CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  youtube_id text NOT NULL,
  duracao text,
  categoria text NOT NULL,
  visibilidade text NOT NULL CHECK (visibilidade IN ('active-students', 'inactive-students', 'guests', 'everyone')),
  tags text[] DEFAULT '{}',
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  instrutor text,
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela de lives do YouTube
CREATE TABLE public.lives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  youtube_stream_key text,
  youtube_url text,
  data_agendamento date NOT NULL,
  hora_agendamento time NOT NULL,
  duracao integer NOT NULL DEFAULT 60,
  status text NOT NULL CHECK (status IN ('scheduled', 'live', 'ended')),
  visibilidade text NOT NULL CHECK (visibilidade IN ('active-students', 'inactive-students', 'guests', 'everyone')),
  max_participantes integer DEFAULT 100,
  num_inscricoes integer DEFAULT 0,
  lembretes_ativados boolean DEFAULT true,
  auto_gravar boolean DEFAULT true,
  tags text[] DEFAULT '{}',
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.treinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para treinos
CREATE POLICY "Coaches podem ver seus próprios treinos"
  ON public.treinos FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar treinos"
  ON public.treinos FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus próprios treinos"
  ON public.treinos FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus próprios treinos"
  ON public.treinos FOR DELETE
  USING (auth.uid() = coach_id);

-- Políticas RLS para vídeos
CREATE POLICY "Coaches podem ver seus próprios vídeos"
  ON public.videos FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar vídeos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar seus próprios vídeos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar seus próprios vídeos"
  ON public.videos FOR DELETE
  USING (auth.uid() = coach_id);

-- Políticas RLS para lives
CREATE POLICY "Coaches podem ver suas próprias lives"
  ON public.lives FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem criar lives"
  ON public.lives FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches podem atualizar suas próprias lives"
  ON public.lives FOR UPDATE
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches podem deletar suas próprias lives"
  ON public.lives FOR DELETE
  USING (auth.uid() = coach_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_treinos_updated_at
  BEFORE UPDATE ON public.treinos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_lives_updated_at
  BEFORE UPDATE ON public.lives
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();