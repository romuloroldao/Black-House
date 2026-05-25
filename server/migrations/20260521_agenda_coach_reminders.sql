-- Lembretes automáticos para coach baseados em public.agenda_eventos

DO $$ BEGIN
  CREATE TYPE public.agenda_coach_milestone AS ENUM (
    'D_MINUS_2', 'D_MINUS_1', 'D_DAY', 'OVERDUE_DAILY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.coach_notification_channel AS ENUM ('in_app_only', 'in_app_and_email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS notification_channel public.coach_notification_channel
    NOT NULL DEFAULT 'in_app_and_email';

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS reminder_cycle_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_coach_pendente_data
  ON public.agenda_eventos (coach_id, data_evento)
  WHERE status = 'pendente';

CREATE TABLE IF NOT EXISTS public.agenda_coach_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_evento_id uuid NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  reminder_cycle_id uuid NOT NULL,
  milestone public.agenda_coach_milestone NOT NULL,
  event_date date NOT NULL,
  event_tipo text NOT NULL,
  dispatch_on date NOT NULL DEFAULT CURRENT_DATE,
  notification_channel public.coach_notification_channel,
  email_status text NOT NULL DEFAULT 'pending',
  email_provider text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_coach_reminder_dispatches_cycle_unique
    UNIQUE (agenda_evento_id, reminder_cycle_id, milestone),
  CONSTRAINT agenda_coach_reminder_dispatches_overdue_daily_unique
    UNIQUE (agenda_evento_id, milestone, dispatch_on)
);

CREATE INDEX IF NOT EXISTS idx_agenda_coach_dispatches_coach
  ON public.agenda_coach_reminder_dispatches (coach_id, created_at DESC);

UPDATE public.agenda_eventos
SET reminder_cycle_id = gen_random_uuid()
WHERE reminder_cycle_id IS NULL
  AND status = 'pendente'
  AND data_evento IS NOT NULL;
