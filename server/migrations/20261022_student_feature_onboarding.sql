-- Preferências de onboarding contextual por aluno e por tutorial.
-- Aplicar: sudo -u postgres psql -d blackhouse_db -f server/migrations/20261022_student_feature_onboarding.sql

CREATE TABLE IF NOT EXISTS public.student_feature_onboarding (
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  onboarding_id text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  state text NOT NULL DEFAULT 'never'
    CHECK (state IN ('never', 'in_progress', 'completed', 'skipped', 'dismissed_permanently')),
  dismiss_permanently boolean NOT NULL DEFAULT false,
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aluno_id, onboarding_id)
);

CREATE INDEX IF NOT EXISTS idx_student_feature_onboarding_aluno
  ON public.student_feature_onboarding (aluno_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_feature_onboarding TO app_user;
