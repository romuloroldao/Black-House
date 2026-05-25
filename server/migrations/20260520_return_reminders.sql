-- Retorno de dieta/treino: agendamento, ledger idempotente e preferências do aluno

DO $$ BEGIN
  CREATE TYPE public.automation_domain AS ENUM ('diet', 'workout');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.return_milestone AS ENUM ('D_MINUS_2', 'D_MINUS_1', 'D_DAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.student_notification_channel AS ENUM ('in_app_only', 'in_app_and_email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Preferências e timezone do aluno
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS notification_channel public.student_notification_channel
    NOT NULL DEFAULT 'in_app_and_email';

-- Dieta: data de retorno e ciclo de agendamento
ALTER TABLE public.dietas
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_cycle_id uuid;

-- Treino do aluno: data de retorno (sinónimo operacional de data_expiracao)
ALTER TABLE public.alunos_treinos
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS schedule_cycle_id uuid;

UPDATE public.alunos_treinos
SET data_retorno = data_expiracao
WHERE data_retorno IS NULL AND data_expiracao IS NOT NULL;

UPDATE public.alunos_treinos
SET data_expiracao = data_retorno
WHERE data_expiracao IS NULL AND data_retorno IS NOT NULL;

-- Ledger de disparos (idempotência)
CREATE TABLE IF NOT EXISTS public.return_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain public.automation_domain NOT NULL,
  entity_id uuid NOT NULL,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  schedule_cycle_id uuid NOT NULL,
  milestone public.return_milestone NOT NULL,
  return_date date NOT NULL,
  notification_channel public.student_notification_channel,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'skipped', 'skipped_no_user', 'skipped_preference', 'failed')),
  email_provider text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_reminder_dispatches_unique
    UNIQUE (domain, entity_id, schedule_cycle_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_return_reminder_dispatches_return_date
  ON public.return_reminder_dispatches (return_date, domain, milestone);

CREATE INDEX IF NOT EXISTS idx_dietas_data_retorno_ativa
  ON public.dietas (data_retorno)
  WHERE ativa = true AND data_retorno IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alunos_treinos_data_retorno_ativo
  ON public.alunos_treinos (data_retorno)
  WHERE COALESCE(ativo, true) = true AND data_retorno IS NOT NULL;
