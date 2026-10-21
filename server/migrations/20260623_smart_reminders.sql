-- Lembretes inteligentes: ledger unificado, aderência e metadados em notificações

DO $$ BEGIN
  CREATE TYPE public.task_domain AS ENUM (
    'checkin_weekly',
    'workout_daily',
    'photos_weekly',
    'payment',
    'profile_incomplete',
    'return_diet',
    'return_workout',
    'agenda_student'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_milestone AS ENUM (
    'INITIAL',
    'PRE_DEADLINE_2H',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_dispatch_status AS ENUM (
    'pending',
    'sent',
    'cancelled',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE TABLE IF NOT EXISTS public.task_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain public.task_domain NOT NULL,
  entity_id text NOT NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  flow_cycle_id uuid NOT NULL,
  milestone public.reminder_milestone NOT NULL,
  scheduled_at timestamptz NOT NULL,
  deadline_at timestamptz,
  status public.reminder_dispatch_status NOT NULL DEFAULT 'pending',
  cancel_reason text,
  notification_channel public.student_notification_channel,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'skipped', 'skipped_no_user', 'skipped_preference', 'failed')),
  email_provider text,
  email_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_reminder_dispatches_unique
    UNIQUE (domain, entity_id, flow_cycle_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_task_reminder_dispatches_due
  ON public.task_reminder_dispatches (status, scheduled_at)
  WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS idx_task_reminder_dispatches_aluno
  ON public.task_reminder_dispatches (aluno_id, domain, created_at DESC);

CREATE TABLE IF NOT EXISTS public.task_adherence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain public.task_domain NOT NULL,
  entity_id text NOT NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  flow_cycle_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('completed', 'missed', 'cancelled')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  CONSTRAINT task_adherence_events_unique
    UNIQUE (domain, entity_id, flow_cycle_id, outcome)
);

CREATE INDEX IF NOT EXISTS idx_task_adherence_aluno
  ON public.task_adherence_events (aluno_id, domain, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificacoes_metadata_flow
  ON public.notificacoes ((metadata->>'flow_cycle_id'))
  WHERE metadata IS NOT NULL AND lida = false;
