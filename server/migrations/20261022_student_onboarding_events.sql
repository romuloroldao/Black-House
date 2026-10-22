-- Eventos mínimos de onboarding contextual (sem PII / saúde / conteúdo).
-- Aplicar: copiar para /tmp e sudo -u postgres psql -d blackhouse_db -f ...

CREATE TABLE IF NOT EXISTS public.student_onboarding_events (
  id bigserial PRIMARY KEY,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  onboarding_id text NOT NULL,
  event_name text NOT NULL
    CHECK (event_name IN (
      'eligible',
      'viewed',
      'step_viewed',
      'completed',
      'skipped',
      'dismissed_permanently',
      'reopened'
    )),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  step_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_onboarding_events_aluno_created
  ON public.student_onboarding_events (aluno_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_onboarding_events_name_created
  ON public.student_onboarding_events (onboarding_id, event_name, created_at DESC);

GRANT SELECT, INSERT ON public.student_onboarding_events TO app_user;
GRANT USAGE, SELECT ON SEQUENCE public.student_onboarding_events_id_seq TO app_user;
