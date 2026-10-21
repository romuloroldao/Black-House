# Spec Phase 1a — Persistência de Execução Diária

| Campo | Valor |
|-------|--------|
| **Fase** | 1a — Daily Execution Persistence |
| **Data** | 2026-07-26 |
| **Dependências** | Nenhuma (bloqueante para Daily Agent) |
| **PRD** | [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md) EX-01…EX-05 |
| **Estado actual** | Checklist refeição e cargas de treino só em `localStorage` (`diet-student-utils.ts`, `workout-session-utils.ts`) |

**Objectivo:** tornar a execução do plano observável e registável no servidor, para que o agente (e o coach) vejam a realidade — não o browser do aluno.

---

## 1. Problema

| Dado | Onde está hoje | Problema |
|------|----------------|----------|
| Refeição concluída | `bh-meal-done:{date}:{dietaId}:{mealKey}:{plano}` | Invisível ao backend/agente/coach |
| Progresso sessão treino | `bh-workout-session:{treinoId}:{date}` | Idem |
| Histórico de cargas | `bh-workout-load-history:{treinoId}` | Só carga string; sem reps/RPE/dor; sem BD |

---

## 2. Modelo de dados

Migrar via `server/migrations/YYYYMMDD_daily_execution.sql` e reflectir no canónico conforme o fluxo habitual do projecto (`npm run db:migrate` / `schema_adaptado_postgres.sql`).

### 2.1 `refeicao_conclusoes`

```sql
CREATE TABLE IF NOT EXISTS public.refeicao_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  dieta_id uuid NOT NULL REFERENCES public.dietas(id) ON DELETE CASCADE,
  data_ref date NOT NULL,                    -- dia civil do aluno (YYYY-MM-DD)
  meal_key text NOT NULL,                    -- mesmo key da UI (nome normalizado do grupo)
  plano text NOT NULL DEFAULT 'A'
    CHECK (plano IN ('A', 'B', 'UNICO')),
  concluido boolean NOT NULL DEFAULT true,
  concluido_em timestamptz,
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent', 'import')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refeicao_conclusoes_unique
    UNIQUE (aluno_id, dieta_id, data_ref, meal_key, plano)
);

CREATE INDEX IF NOT EXISTS idx_refeicao_conclusoes_aluno_data
  ON public.refeicao_conclusoes (aluno_id, data_ref DESC);
```

**Notas:**

- `meal_key` deve alinhar com `MealGroup.key` em `diet-student-utils` (não inventar outro identificador).
- `plano`: usar rotação do dia (`dieta_rotacao.plano`) ou `'UNICO'` se dieta sem A/B.
- Toggle off: `concluido = false` (manter linha para audit) ou DELETE — **recomendação: soft via `concluido`** para idempotência do agente.

### 2.2 `treino_sessoes`

```sql
CREATE TABLE IF NOT EXISTS public.treino_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  aluno_treino_id uuid REFERENCES public.alunos_treinos(id) ON DELETE SET NULL,
  treino_id uuid NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- ex.: completedIndexes snapshot
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treino_sessoes_aluno_treino_dia_unique
    UNIQUE (aluno_id, treino_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_treino_sessoes_aluno_data
  ON public.treino_sessoes (aluno_id, data_ref DESC);
```

### 2.3 `treino_serie_logs`

```sql
CREATE TABLE IF NOT EXISTS public.treino_serie_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL
    REFERENCES public.treino_sessoes(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  exercise_index int NOT NULL CHECK (exercise_index >= 0),
  exercise_name text NOT NULL,
  set_index int NOT NULL DEFAULT 1 CHECK (set_index >= 1),
  carga text,                    -- compatível com UI actual ("40 kg")
  repeticoes numeric(8,2),       -- opcional no MVP UI; obrigatório progressivo na fase 3
  rpe numeric(4,1) CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10)),
  dor numeric(4,1) CHECK (dor IS NULL OR (dor >= 0 AND dor <= 10)),
  concluido boolean NOT NULL DEFAULT true,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'ui'
    CHECK (origem IN ('ui', 'agent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT treino_serie_logs_unique
    UNIQUE (sessao_id, exercise_index, set_index)
);

CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_aluno
  ON public.treino_serie_logs (aluno_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_treino_serie_logs_sessao
  ON public.treino_serie_logs (sessao_id, exercise_index, set_index);
```

**Compatibilidade UI actual:** a sessão guiada hoje marca exercício completo + uma carga. Mapear para:

- `set_index = 1` (ou N séries prescritas se a UI evoluir)
- `carga` = `pesoUsado`
- `repeticoes` / `rpe` / `dor` = null até a UI/agente os enviarem

### 2.4 Aderência

Ao concluir refeição / sessão:

```text
task_adherence_events
  domain: 'meal_daily' | 'workout_daily'   -- alargar ENUM se necessário
  outcome: 'completed' | 'missed' | 'cancelled'
  metadata: { dieta_id?, meal_key?, treino_id?, sessao_id? }
```

Se o ENUM actual não permitir novos domains, adicionar valores na mesma migração (hoje o ENUM lista `workout_daily` mas o handler não grava).

---

## 3. APIs

Todas: `authenticate` + role `aluno` + resolver `aluno_id` do utilizador (self-scope). Coach read-only opcional na mesma fase ou logo a seguir (`GET` por `aluno_id` com `assertCoachCanAccessAluno`).

### 3.1 Refeições

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/alunos/me/refeicao-conclusoes?date=YYYY-MM-DD` | Lista do dia (default hoje) |
| `PUT` | `/api/alunos/me/refeicao-conclusoes` | Upsert conclusão (idempotente) |

**Body PUT:**

```json
{
  "dieta_id": "uuid",
  "data_ref": "2026-07-26",
  "meal_key": "cafe-da-manha",
  "plano": "A",
  "concluido": true,
  "origem": "ui"
}
```

**Resposta:** linha upsertada + `gerado_em`.

**Idempotência:** UNIQUE natural; PUT repetido com mesmo estado = no-op lógico (actualizar `updated_at`).

### 3.2 Treino

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/alunos/me/treino-sessoes?date=YYYY-MM-DD` | Sessão do dia + séries |
| `POST` | `/api/alunos/me/treino-sessoes` | Iniciar / obter sessão do dia |
| `PATCH` | `/api/alunos/me/treino-sessoes/:id` | `status`, `metadata.completedIndexes` |
| `PUT` | `/api/alunos/me/treino-sessoes/:id/series` | Upsert log de série/exercício |
| `GET` | `/api/alunos/me/treino-cargas?treino_id=` | Histórico recentes (substitui local history) |

**Body PUT series:**

```json
{
  "exercise_index": 0,
  "exercise_name": "Agachamento",
  "set_index": 1,
  "carga": "40 kg",
  "repeticoes": 10,
  "rpe": 7.5,
  "dor": null,
  "concluido": true,
  "origem": "ui"
}
```

### 3.3 Extensão de `/api/alunos/me/hoje`

Incluir no payload (sem breaking change — campos novos):

```json
{
  "execucao": {
    "refeicoes_concluidas": [{ "meal_key", "plano", "concluido_em" }],
    "treino_sessao": { "id", "status", "completed_indexes", "series_count" }
  }
}
```

Actualizar `src/types/aluno-hoje.ts` e contrato `api-contract.ts`.

---

## 4. Camada server

| Artefacto | Path sugerido |
|-----------|---------------|
| Repository | `server/repositories/refeicao-conclusao.repository.js` |
| Repository | `server/repositories/treino-sessao.repository.js` |
| Service | `server/services/refeicao-conclusao.service.js` |
| Service | `server/services/treino-sessao.service.js` |
| Routes | `server/routes/execucao-diaria.js` montado em `/api` |
| Schemas Zod | `server/schemas/execucao-diaria-schema.js` |
| Testes | `server/tests/execucao-diaria.*.test.js` |

Services **callable sem req/res** (assinatura com `pool` + `alunoId`) para reuse nas agent tools (Phase 1b/2).

---

## 5. Frontend — migração

### 5.1 Dieta

Ficheiros: `src/lib/diet-student-utils.ts`, `src/components/student/StudentDietView.tsx`.

1. `writeMealDone` / `readMealDone` passam a chamar API (com debounce curto no toggle).
2. **Dual-read** na primeira versão: se API falhar, fallback `localStorage`.
3. Após sucesso API, espelhar em localStorage (cache offline leve) opcional.
4. Remover fallback local como fonte de verdade após estabilizar (flag ou 1 sprint).

### 5.2 Treino

Ficheiros: `src/lib/workout-session-utils.ts`, `src/components/student/StudentWorkoutSessionView.tsx`.

1. Ao abrir sessão: `POST` sessão do dia.
2. Ao marcar exercício: `PUT` série (+ carga).
3. Histórico: `GET treino-cargas` em vez de só local.
4. Mesmo dual-read/write curto.

### 5.3 Contrato

Declarar todos os pathnames novos em `src/contracts/api-contract.ts`.

---

## 6. Próxima acção (preparação para agente)

Nesta fase, expor helper determinístico (ainda sem LLM):

```js
// server/services/proxima-acao.service.js
getProximaAcao(pool, { aluno, userId, now })
```

Regras MVP (ordem):

1. Se acesso bloqueado → acção `resolve_access`
2. Se check-in due (já em pendências) → `checkin` (priority high)
3. Se há refeição não concluída e hora ≥ heurística da ordem → `next_meal`
4. Se há treino hoje e sessão não completed → `today_workout`
5. Senão → `idle` / mensagem de plano em dia

**Heurística de refeição (sem campo `horario`):**

Ordem canónica por `meal_key` / nome (Café → Lanche manhã → Almoço → Lanche → Jantar → Ceia). “Próxima” = primeira não concluída; se todas concluídas, null. Relógio só para copy (“está na hora do…”), não bloqueia conclusão antecipada.

---

## 7. Autorização e segurança

- Aluno só escreve no próprio `aluno_id`.
- Validar `dieta_id` pertence ao aluno; `treino_id` / `aluno_treino_id` activos do aluno.
- Respeitar bloqueios financeiro/operacional nos WRITE (mesmo padrão do portal).
- Rate limit: reutilizar `apiLimiter`; opcional burst limit em toggles (ex. 60/min).

---

## 8. Testes e aceite

| # | Critério |
|---|----------|
| 1 | PUT conclusão cria/atualiza linha UNIQUE |
| 2 | GET dia reflecte estado após toggle |
| 3 | Sessão treino + série persistem; GET histórico devolve carga |
| 4 | `/hoje` inclui `execucao` |
| 5 | UI dieta/treino funciona com localStorage limpo (API only) |
| 6 | Aluno A não lê/escreve dados do aluno B |
| 7 | Testes unit/integration dos services |

---

## 9. Fora de escopo (1a)

- Orchestrator / LLM
- Persistência de substituição escolhida (fase 4)
- Campo `horario` em refeições (opcional depois)
- UI coach de “aderência diária” completa (GET coach pode ser mínimo)

---

## 10. Ordem de implementação sugerida

1. Migração SQL + repositories + services + testes
2. Rotas + contrato frontend
3. Estender `/hoje`
4. Migrar `StudentDietView`
5. Migrar `StudentWorkoutSessionView`
6. `getProximaAcao` + testes
7. Remover dependência hard de localStorage

---

*Spec técnica Phase 1a. Implementação em etapa de código separada.*
