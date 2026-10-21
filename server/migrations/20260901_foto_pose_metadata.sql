-- Metadados de pose normalizada para fotos de evolução (check-in)
-- Hierarquia: coach > vision > (aluno só auditoria)

ALTER TABLE public.fotos_alunos
  ADD COLUMN IF NOT EXISTS pose_aluno text,
  ADD COLUMN IF NOT EXISTS pose_vision text,
  ADD COLUMN IF NOT EXISTS pose_vision_confidence numeric(4, 3),
  ADD COLUMN IF NOT EXISTS pose_vision_reason text,
  ADD COLUMN IF NOT EXISTS pose_coach text,
  ADD COLUMN IF NOT EXISTS pose_source text,
  ADD COLUMN IF NOT EXISTS pose_efetiva text,
  ADD COLUMN IF NOT EXISTS pose_quality jsonb,
  ADD COLUMN IF NOT EXISTS pose_analysis_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pose_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS pose_analysis_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fotos_alunos_pose_status
  ON public.fotos_alunos (pose_analysis_status)
  WHERE pose_analysis_status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS idx_fotos_alunos_content_hash
  ON public.fotos_alunos (content_hash)
  WHERE content_hash IS NOT NULL;

-- Backfill inicial: fotos com descricao válida → classified; resto → pending
UPDATE public.fotos_alunos
SET
  pose_efetiva = CASE
    WHEN descricao IN ('frente', 'costas', 'lado_esquerdo', 'lado_direito') THEN descricao
    WHEN descricao IN ('desconhecido', 'invalido', 'incerto') THEN
      CASE WHEN descricao = 'incerto' THEN 'desconhecido' ELSE descricao END
    ELSE NULL
  END,
  pose_source = CASE
    WHEN descricao IN ('frente', 'costas', 'lado_esquerdo', 'lado_direito') THEN 'student'
    ELSE 'unknown'
  END,
  pose_aluno = descricao,
  pose_analysis_status = CASE
    WHEN descricao IN ('frente', 'costas', 'lado_esquerdo', 'lado_direito', 'desconhecido', 'invalido', 'incerto')
      THEN 'classified'
    ELSE 'pending'
  END,
  pose_analyzed_at = CASE
    WHEN descricao IN ('frente', 'costas', 'lado_esquerdo', 'lado_direito', 'desconhecido', 'invalido', 'incerto')
      THEN COALESCE(created_at, now())
    ELSE NULL
  END
WHERE pose_analysis_status IS NULL OR pose_analysis_status = 'pending';
