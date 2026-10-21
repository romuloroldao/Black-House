-- Peso no check-in semanal + vínculo de fotos ao registo

ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS peso_kg numeric(6, 2);

COMMENT ON COLUMN public.weekly_checkins.peso_kg IS 'Peso corporal (kg) reportado no check-in semanal';

ALTER TABLE public.fotos_alunos
  ADD COLUMN IF NOT EXISTS weekly_checkin_id uuid;

DO $$ BEGIN
  ALTER TABLE public.fotos_alunos
    ADD CONSTRAINT fotos_alunos_weekly_checkin_id_fkey
    FOREIGN KEY (weekly_checkin_id) REFERENCES public.weekly_checkins(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fotos_alunos_weekly_checkin_id
  ON public.fotos_alunos (weekly_checkin_id)
  WHERE weekly_checkin_id IS NOT NULL;
