-- Phase 1b: Agent Foundation (sessões, runs, tools, decisions, approvals)

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES app_auth.users(id),
  user_id uuid NOT NULL REFERENCES app_auth.users(id),
  channel text NOT NULL DEFAULT 'student_hoje'
    CHECK (channel IN ('student_hoje', 'api', 'coach_panel')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_aluno
  ON public.agent_sessions (aluno_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_open
  ON public.agent_sessions (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session
  ON public.agent_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  intent_raw text,
  intent_classified text,
  provider text,
  model text,
  tokens_in int,
  tokens_out int,
  cost_estimate_usd numeric(12,6),
  latency_ms int,
  error_code text,
  error_message text,
  autonomy_max int NOT NULL DEFAULT 2,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_session
  ON public.agent_runs (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  autonomy_level int NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  ok boolean NOT NULL DEFAULT false,
  error_message text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run
  ON public.agent_tool_calls (run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid REFERENCES app_auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_session
  ON public.agent_approvals (session_id, status, created_at DESC);
