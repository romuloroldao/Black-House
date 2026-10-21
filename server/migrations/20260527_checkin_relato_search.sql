-- BH-CHECKIN-009: busca em relatos (nao_cumpriu_porque)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_relato_trgm
  ON public.weekly_checkins
  USING gin (nao_cumpriu_porque gin_trgm_ops);

COMMENT ON INDEX public.idx_weekly_checkins_relato_trgm IS 'Busca por texto em relatos de check-in (pg_trgm)';
