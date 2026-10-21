-- Phase 6: Coach Knowledge — regras operacionais tipadas (sem vector KB)

CREATE TABLE IF NOT EXISTS public.coach_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL
    CHECK (domain IN (
      'general', 'nutrition', 'training', 'checkin', 'communication', 'free_meal'
    )),
  trigger text NOT NULL DEFAULT 'always'
    CHECK (trigger IN (
      'always', 'restaurant', 'substitution', 'workout', 'late', 'complete', 'checkin'
    )),
  priority smallint NOT NULL DEFAULT 100,
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'seed_refeicao_livre', 'import')),
  source_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_rules_title_len CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT coach_rules_body_len CHECK (char_length(body) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_coach_rules_coach_active
  ON public.coach_rules (coach_id, active, priority ASC, created_at ASC);
