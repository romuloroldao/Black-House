-- Identidade estável do exercício + carga numérica para análise semanal.
-- CREATE TABLE IF NOT EXISTS não acrescenta colunas em bases já criadas.

ALTER TABLE public.treino_serie_logs
  ADD COLUMN IF NOT EXISTS slot_key uuid;

ALTER TABLE public.treino_serie_logs
  ADD COLUMN IF NOT EXISTS carga_valor numeric(10, 2);

ALTER TABLE public.treino_serie_logs
  ADD COLUMN IF NOT EXISTS carga_unidade text;

ALTER TABLE public.treino_serie_logs DROP CONSTRAINT IF EXISTS treino_serie_logs_carga_unidade_check;
ALTER TABLE public.treino_serie_logs ADD CONSTRAINT treino_serie_logs_carga_unidade_check
  CHECK (carga_unidade IS NULL OR carga_unidade = ANY (ARRAY['kg'::text, 'lb'::text]));

CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_aluno_slot
  ON public.treino_serie_logs (aluno_id, slot_key)
  WHERE slot_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_aluno_data_ex
  ON public.treino_serie_logs (aluno_id, registrado_em DESC, exercise_name);
