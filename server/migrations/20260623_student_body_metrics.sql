-- Dados corporais, histórico de peso, indicadores (TMB) e estado de completude de perfil

DO $$ BEGIN
  CREATE TYPE public.body_metric_source AS ENUM (
    'signup', 'profile_edit', 'weekly_checkin', 'coach_edit', 'import', 'integration'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS peso_kg numeric(6, 2),
  ADD COLUMN IF NOT EXISTS altura_cm numeric(5, 2),
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_grace_logins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.alunos DROP CONSTRAINT IF EXISTS alunos_sexo_check;
ALTER TABLE public.alunos ADD CONSTRAINT alunos_sexo_check
  CHECK (sexo IS NULL OR sexo = ANY (ARRAY['M'::text, 'F'::text]));

-- Backfill peso/altura
UPDATE public.alunos
SET peso_kg = peso::numeric
WHERE peso_kg IS NULL AND peso IS NOT NULL;

UPDATE public.alunos
SET altura_cm = altura
WHERE altura_cm IS NULL AND altura IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.aluno_peso_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  peso_kg numeric(6, 2) NOT NULL CHECK (peso_kg >= 30 AND peso_kg <= 350),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  origem public.body_metric_source NOT NULL,
  origem_id uuid,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peso_hist_aluno_data
  ON public.aluno_peso_historico (aluno_id, registrado_em DESC);

CREATE TABLE IF NOT EXISTS public.aluno_indicadores_saude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  valor numeric NOT NULL,
  unidade text NOT NULL,
  formula text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.student_profile_state (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES app_auth.users(id),
  is_complete boolean NOT NULL DEFAULT false,
  missing_fields text[] NOT NULL DEFAULT '{}',
  completion_pct smallint NOT NULL DEFAULT 0,
  grace_expires_at timestamptz,
  hard_gate_active boolean NOT NULL DEFAULT false,
  last_reminder_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_profile_state_coach
  ON public.student_profile_state (coach_id, is_complete);

-- Histórico inicial a partir do peso actual
INSERT INTO public.aluno_peso_historico (aluno_id, peso_kg, origem, registrado_em)
SELECT a.id, a.peso_kg, 'import'::public.body_metric_source, COALESCE(a.created_at, now())
FROM public.alunos a
WHERE a.peso_kg IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.aluno_peso_historico h WHERE h.aluno_id = a.id
  );

-- Histórico a partir de check-ins (sem duplicar mesma semana)
INSERT INTO public.aluno_peso_historico (aluno_id, peso_kg, origem, origem_id, registrado_em)
SELECT wc.aluno_id, wc.peso_kg, 'weekly_checkin'::public.body_metric_source, wc.id, wc.created_at
FROM public.weekly_checkins wc
WHERE wc.peso_kg IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.aluno_peso_historico h
    WHERE h.origem = 'weekly_checkin' AND h.origem_id = wc.id
  );
