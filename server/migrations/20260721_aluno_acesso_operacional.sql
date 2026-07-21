-- Gestão de acesso operacional do aluno (independente do bloqueio financeiro).
-- pending | active | suspended | revoked

BEGIN;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS acesso_operacional text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS acesso_operacional_em timestamptz,
  ADD COLUMN IF NOT EXISTS acesso_operacional_por uuid REFERENCES app_auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acesso_operacional_nota text;

ALTER TABLE public.alunos DROP CONSTRAINT IF EXISTS alunos_acesso_operacional_check;
ALTER TABLE public.alunos ADD CONSTRAINT alunos_acesso_operacional_check
  CHECK (acesso_operacional IN ('pending', 'active', 'suspended', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_alunos_acesso_operacional
  ON public.alunos (coach_id, acesso_operacional);

-- Backfill: vínculo + email confirmado → active; resto permanece pending
DO $$
DECLARE
  link_col text;
BEGIN
  SELECT column_name INTO link_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'alunos'
    AND column_name IN ('linked_user_id', 'user_id')
  ORDER BY CASE column_name WHEN 'linked_user_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF link_col IS NULL THEN
    RAISE NOTICE 'Sem coluna de vínculo user — backfill só default pending';
  ELSE
    EXECUTE format($q$
      UPDATE public.alunos a
      SET
        acesso_operacional = 'active',
        acesso_operacional_em = COALESCE(a.acesso_operacional_em, now()),
        acesso_operacional_nota = COALESCE(a.acesso_operacional_nota, 'Backfill: vínculo e email confirmados')
      FROM app_auth.users u
      WHERE a.%I = u.id
        AND u.email_confirmed_at IS NOT NULL
        AND a.acesso_operacional = 'pending'
    $q$, link_col);
  END IF;
END $$;

COMMIT;
