-- Categorias de alimentos por profissional (organização pessoal da lista de substituição).
-- Não alteram public.alimentos nem public.tipos_alimentos (globais): só agrupam referências.
-- Um alimento está em no máximo uma categoria por profissional (PK coach_id + alimento_id),
-- por isso mover entre categorias nunca duplica. Apagar uma categoria remove só as ligações:
-- os alimentos voltam a "Sem categoria".
-- Aplicar: sudo -u postgres psql -d blackhouse_db -f server/migrations/20261109_coach_food_categories.sql

CREATE TABLE IF NOT EXISTS public.coach_food_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 60),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_food_categories_nome
  ON public.coach_food_categories (coach_id, lower(btrim(nome)));

-- Alvo da FK composta: a ligação só aceita categoria do mesmo profissional.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_food_categories_id_coach
  ON public.coach_food_categories (id, coach_id);

CREATE TABLE IF NOT EXISTS public.coach_food_category_items (
  coach_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  alimento_id uuid NOT NULL REFERENCES public.alimentos(id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, alimento_id),
  CONSTRAINT coach_food_category_items_category_fk
    FOREIGN KEY (category_id, coach_id)
    REFERENCES public.coach_food_categories (id, coach_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coach_food_category_items_category
  ON public.coach_food_category_items (category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_food_categories TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_food_category_items TO app_user;
