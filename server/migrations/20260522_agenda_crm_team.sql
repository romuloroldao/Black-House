-- CRM leve, snooze, sync agenda, equipa, tipos consulta/acompanhamento

DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE 'assistant';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tipos nativos na Agenda (mantém legado)
ALTER TABLE public.agenda_eventos DROP CONSTRAINT IF EXISTS agenda_eventos_tipo_check;
ALTER TABLE public.agenda_eventos ADD CONSTRAINT agenda_eventos_tipo_check CHECK (
  tipo = ANY (ARRAY[
    'retorno'::text, 'ajuste_dieta'::text, 'alteracao_treino'::text,
    'avaliacao'::text, 'outro'::text, 'consulta'::text, 'acompanhamento'::text
  ])
);

UPDATE public.agenda_eventos SET tipo = 'consulta' WHERE tipo = 'avaliacao';
UPDATE public.agenda_eventos SET tipo = 'acompanhamento' WHERE tipo = 'outro' AND titulo ILIKE '%acompanh%';

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS snoozed_until date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_eventos_source_unique
  ON public.agenda_eventos (source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- CRM leve no aluno
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_contato_tipo text,
  ADD COLUMN IF NOT EXISTS ultimo_contato_resumo text,
  ADD COLUMN IF NOT EXISTS ultimo_contato_agenda_evento_id uuid;

-- Equipa do coach
CREATE TABLE IF NOT EXISTS public.coach_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  team_role text NOT NULL DEFAULT 'assistant'
    CHECK (team_role IN ('assistant', 'viewer')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_team_members_unique UNIQUE (owner_coach_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_team_members_member
  ON public.coach_team_members (member_user_id) WHERE ativo = true;
