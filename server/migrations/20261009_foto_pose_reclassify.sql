-- Reclassificação de pose sem tirar a foto das comparações (status continua 'classified').
-- O job processa estas fotos depois das pendentes; aplicar como owner da tabela (postgres).

ALTER TABLE public.fotos_alunos
  ADD COLUMN IF NOT EXISTS pose_reclassify_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_fotos_alunos_pose_reclassify
  ON public.fotos_alunos (pose_reclassify_at)
  WHERE pose_reclassify_at IS NOT NULL;
