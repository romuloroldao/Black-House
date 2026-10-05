-- Periodização de Treino: anexa guia educativo (PDF) à ficha de treino
-- Espelha o padrão dietas.refeicao_livre_* → educational_contents

ALTER TABLE public.treinos
  ADD COLUMN IF NOT EXISTS periodizacao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS periodizacao_observacao text,
  ADD COLUMN IF NOT EXISTS periodizacao_content_id uuid;

DO $$ BEGIN
  ALTER TABLE public.treinos
    ADD CONSTRAINT treinos_periodizacao_content_id_fkey
    FOREIGN KEY (periodizacao_content_id)
    REFERENCES public.educational_contents(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_treinos_periodizacao_content_id
  ON public.treinos (periodizacao_content_id)
  WHERE periodizacao_content_id IS NOT NULL;

COMMENT ON COLUMN public.treinos.periodizacao_ativa IS
  'Quando true, o aluno vê o guia de periodização vinculado à ficha.';
COMMENT ON COLUMN public.treinos.periodizacao_observacao IS
  'Notas do coach sobre como aplicar a periodização neste treino.';
COMMENT ON COLUMN public.treinos.periodizacao_content_id IS
  'FK para educational_contents (categoria Periodizações de Treino).';
