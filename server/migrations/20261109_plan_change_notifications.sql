-- Avisos ao aluno quando o profissional altera dieta ou treino.
-- Uma linha por janela de edição (debounce): várias gravações seguidas geram um único aviso,
-- disparado só depois de a última gravação ter sido confirmada no banco.
-- Estados: pending → processing → sent | failed | cancelled (falha temporária volta a pending).
-- "sent" = aviso no app gravado e e-mail entregue à fila; o envio SMTP real fica em email_queue.status.
-- Aplicar: sudo -u postgres psql -d blackhouse_db -f server/migrations/20261109_plan_change_notifications.sql

CREATE TABLE IF NOT EXISTS public.plan_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid,
  dominio text NOT NULL CHECK (dominio IN ('dieta', 'treino')),
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  change_count integer NOT NULL DEFAULT 1 CHECK (change_count >= 1),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  first_change_at timestamptz NOT NULL DEFAULT now(),
  last_change_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  recipient_user_id uuid,
  notificacao_id uuid,
  in_app_status text NOT NULL DEFAULT 'pending'
    CHECK (in_app_status IN ('pending', 'created', 'failed', 'skipped')),
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'queued', 'skipped_preference', 'skipped_no_email', 'failed')),
  email_queue_id uuid,
  socket_emitted boolean NOT NULL DEFAULT false,
  dispatched_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deduplicação: no máximo um aviso pendente por aluno e domínio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_change_notifications_pending
  ON public.plan_change_notifications (aluno_id, dominio)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_plan_change_notifications_due
  ON public.plan_change_notifications (status, due_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_plan_change_notifications_aluno_created
  ON public.plan_change_notifications (aluno_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_change_notifications TO app_user;
