-- BH-CHECKIN-005: rastrear resposta do coach por check-in
ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS coach_respondido_em timestamptz,
  ADD COLUMN IF NOT EXISTS coach_respondido_por uuid REFERENCES app_auth.users(id);

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_pendentes_coach
  ON public.weekly_checkins (created_at DESC)
  WHERE coach_respondido_em IS NULL;

COMMENT ON COLUMN public.weekly_checkins.coach_respondido_em IS 'Quando o coach marcou resposta ao check-in';
COMMENT ON COLUMN public.weekly_checkins.coach_respondido_por IS 'Coach/admin que respondeu';
