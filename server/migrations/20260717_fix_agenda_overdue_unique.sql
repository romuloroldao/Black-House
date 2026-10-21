-- Fix: OVERDUE_DAILY must allow one row per day (dispatch_on),
-- but cycle_unique blocked a second day and crashed AgendaCoachRemindersJob.
-- Symptom: no agenda coach reminder dispatches after 2026-06-24.

ALTER TABLE public.agenda_coach_reminder_dispatches
  DROP CONSTRAINT IF EXISTS agenda_coach_reminder_dispatches_cycle_unique;

-- Once per cycle for D-2 / D-1 / D0 only (not overdue daily)
CREATE UNIQUE INDEX IF NOT EXISTS agenda_coach_reminder_dispatches_cycle_unique
  ON public.agenda_coach_reminder_dispatches (agenda_evento_id, reminder_cycle_id, milestone)
  WHERE milestone <> 'OVERDUE_DAILY'::public.agenda_coach_milestone;
