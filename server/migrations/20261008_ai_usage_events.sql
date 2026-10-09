-- Uso de IA externa por funcionalidade (base para decisões de modelo/cota)

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id bigserial PRIMARY KEY,
  feature text NOT NULL DEFAULT 'unknown',
  modality text NOT NULL DEFAULT 'text'
    CHECK (modality IN ('text', 'vision')),
  provider text,
  model text,
  status text NOT NULL
    CHECK (status IN ('ok', 'error')),
  error_kind text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created
  ON public.ai_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature_created
  ON public.ai_usage_events (feature, created_at DESC);
