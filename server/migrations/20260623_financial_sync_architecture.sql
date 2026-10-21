-- Arquitectura financeira: sincronização bidirecional Black House ↔ Asaas

ALTER TABLE public.asaas_config
  ADD COLUMN IF NOT EXISTS webhook_auth_token_encrypted text,
  ADD COLUMN IF NOT EXISTS webhook_id text,
  ADD COLUMN IF NOT EXISTS webhook_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS initial_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reconciliation_at timestamptz;

ALTER TABLE public.asaas_config DROP CONSTRAINT IF EXISTS asaas_config_initial_sync_status_check;
ALTER TABLE public.asaas_config ADD CONSTRAINT asaas_config_initial_sync_status_check CHECK (
  initial_sync_status = ANY (ARRAY['pending','running','completed','failed']::text[])
);

ALTER TABLE public.asaas_customers
  ADD COLUMN IF NOT EXISTS coach_id uuid,
  ADD COLUMN IF NOT EXISTS asaas_external_reference text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS asaas_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asaas_customers_coach_id_fkey') THEN
    ALTER TABLE public.asaas_customers
      ADD CONSTRAINT asaas_customers_coach_id_fkey
      FOREIGN KEY (coach_id) REFERENCES app_auth.users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_customers_coach_aluno
  ON public.asaas_customers (coach_id, aluno_id) WHERE coach_id IS NOT NULL;

ALTER TABLE public.asaas_payments
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS asaas_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS client_payment_date date,
  ADD COLUMN IF NOT EXISTS net_value numeric,
  ADD COLUMN IF NOT EXISTS subscription_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overdue_notification_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_outbound_attempt_at timestamptz;

ALTER TABLE public.asaas_payments ALTER COLUMN asaas_payment_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_payments_coach_external_ref
  ON public.asaas_payments (coach_id, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_payments_coach_status_due
  ON public.asaas_payments (coach_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_asaas_payments_coach_asaas_updated
  ON public.asaas_payments (coach_id, asaas_updated_at);

CREATE TABLE IF NOT EXISTS public.asaas_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES app_auth.users(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  asaas_subscription_id text UNIQUE,
  asaas_customer_id text NOT NULL,
  payment_plan_id uuid REFERENCES public.payment_plans(id),
  external_reference text,
  status text NOT NULL DEFAULT 'ACTIVE',
  value numeric NOT NULL,
  billing_type text NOT NULL DEFAULT 'BOLETO',
  cycle text,
  next_due_date date,
  sync_status text NOT NULL DEFAULT 'synced',
  asaas_updated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_subscriptions_coach_id ON public.asaas_subscriptions(coach_id);
CREATE INDEX IF NOT EXISTS idx_asaas_subscriptions_aluno_id ON public.asaas_subscriptions(aluno_id);

CREATE TABLE IF NOT EXISTS public.financial_sync_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES app_auth.users(id),
  source text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_asaas_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  attempts int NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  CONSTRAINT financial_sync_inbox_coach_event_unique UNIQUE (coach_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_sync_inbox_status ON public.financial_sync_inbox(status, received_at);
CREATE INDEX IF NOT EXISTS idx_financial_sync_inbox_coach ON public.financial_sync_inbox(coach_id, status);

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES app_auth.users(id),
  aluno_id uuid REFERENCES public.alunos(id),
  entity_type text,
  entity_id uuid,
  action text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_coach ON public.financial_audit_log(coach_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_financial_policies (
  coach_id uuid PRIMARY KEY REFERENCES app_auth.users(id),
  grace_period_days int NOT NULL DEFAULT 0,
  block_on_statuses text[] NOT NULL DEFAULT ARRAY['OVERDUE','PENDING_AFTER_DUE_DATE'],
  unblock_on_statuses text[] NOT NULL DEFAULT ARRAY['RECEIVED','CONFIRMED'],
  auto_block_enabled boolean NOT NULL DEFAULT true,
  reminder_days_before int[] NOT NULL DEFAULT ARRAY[3],
  notify_on_block boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_sync_checkpoints (
  coach_id uuid NOT NULL REFERENCES app_auth.users(id),
  resource_type text NOT NULL,
  last_cursor text,
  last_success_at timestamptz,
  PRIMARY KEY (coach_id, resource_type)
);

CREATE TABLE IF NOT EXISTS public.student_access_state (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES app_auth.users(id),
  access_status text NOT NULL DEFAULT 'granted',
  payment_status text NOT NULL DEFAULT 'CURRENT',
  in_grace_period boolean NOT NULL DEFAULT false,
  grace_days_remaining int,
  blocked_at timestamptz,
  unblocked_at timestamptz,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_student_access_state_coach ON public.student_access_state(coach_id, access_status);
