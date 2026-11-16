-- Dia da semana da turma (1=segunda … 7=domingo) e data de retorno marcada no check-in.

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS dia_semana smallint;

ALTER TABLE public.turmas DROP CONSTRAINT IF EXISTS turmas_dia_semana_check;
ALTER TABLE public.turmas
  ADD CONSTRAINT turmas_dia_semana_check
  CHECK (dia_semana IS NULL OR dia_semana BETWEEN 1 AND 7);

COMMENT ON COLUMN public.turmas.dia_semana IS
  'Dia do check-in da turma. 1=segunda … 7=domingo. Nulo = sem lembrete por dia.';

ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS data_retorno date;

COMMENT ON COLUMN public.weekly_checkins.data_retorno IS
  'Próximo retorno marcado pelo coach ao responder este check-in.';
