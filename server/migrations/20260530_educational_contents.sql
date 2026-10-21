-- Biblioteca de Conteúdo Educativo + Refeição Livre (dietas)

CREATE TABLE IF NOT EXISTS public.educational_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  category varchar(100),
  content_type varchar(20) NOT NULL CHECK (content_type IN ('pdf', 'article', 'video')),
  file_url text,
  article_content text,
  video_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_educational_contents_coach_id
  ON public.educational_contents (coach_id);

CREATE INDEX IF NOT EXISTS idx_educational_contents_category
  ON public.educational_contents (category);

CREATE INDEX IF NOT EXISTS idx_educational_contents_active
  ON public.educational_contents (active);

COMMENT ON TABLE public.educational_contents IS
  'Biblioteca reutilizável de conteúdos educativos do coach (PDF, artigo, vídeo).';

ALTER TABLE public.dietas
  ADD COLUMN IF NOT EXISTS refeicao_livre_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refeicao_livre_observacao text,
  ADD COLUMN IF NOT EXISTS refeicao_livre_content_id uuid;

DO $$ BEGIN
  ALTER TABLE public.dietas
    ADD CONSTRAINT dietas_refeicao_livre_content_id_fkey
    FOREIGN KEY (refeicao_livre_content_id)
    REFERENCES public.educational_contents(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
