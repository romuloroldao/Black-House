# Spec Phase 1b — Agent Foundation

| Campo | Valor |
|-------|--------|
| **Fase** | 1b — Agent Foundation |
| **Data** | 2026-07-26 |
| **Dependências** | Phase 1a (mínimo: conclusões + `/hoje.execucao` + `getProximaAcao`) |
| **PRD** | [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md) AF-01…AF-07 |
| **Decisão** | Orquestrador próprio + structured JSON (não lock-in a function-calling nativo) |

**Objectivo:** sessão, contexto, tool calling controlado, policy de autonomia, logs e contratos — sem ainda entregar a UX completa do Daily Agent (Phase 2).

---

## 1. Arquitectura de módulos

```text
server/services/agent/
  index.js                 # facade
  orchestrator.js          # loop: plan → tools → respond
  context-builder.js       # snapshot determinístico
  policy.js                # autonomia 0–4
  tool-registry.js         # catálogo + dispatch
  tools/                   # um ficheiro por tool ou grupo
    read-context.js
    write-execution.js
    action-ui.js
  prompts.js               # system prompts versionados
  cost.js                  # tokens / custo estimado

server/repositories/agent-*.js
server/routes/agent.js     # /api/agent/*
server/schemas/agent-*.js
```

Frontend nesta fase: cliente mínimo / Postman / testes; UI intent fica na Phase 2. Opcional: endpoint interno usado só por e2e.

---

## 2. Modelo de dados

### 2.1 `agent_sessions`

```sql
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
```

### 2.2 `agent_messages`

```sql
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,  -- cards, tool results summary
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session
  ON public.agent_messages (session_id, created_at ASC);
```

### 2.3 `agent_runs`

```sql
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
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, -- allowlist fields only
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
```

### 2.4 `agent_tool_calls`

```sql
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
```

### 2.5 `agent_decisions` / `agent_approvals`

```sql
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- e.g. 'refuse_high_impact', 'suggest_only'
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  action_type text NOT NULL,    -- e.g. 'send_message_to_coach'
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid REFERENCES app_auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
```

---

## 3. Context builder

`buildStudentAgentContext(pool, { aluno, userId, now })` agrega **apenas allowlist**:

| Bloco | Fonte |
|-------|--------|
| `aluno` | id, nome, objetivo (sem PII extra desnecessária) |
| `acesso` | payment_status + access operacional |
| `hoje` | `getAlunoHoje` |
| `execucao` | conclusões + sessão treino do dia |
| `proxima_acao` | `getProximaAcao` |
| `refeicao_actual` | detalhe da meal_key sugerida (itens resumidos) |
| `treino_actual` | nome, descanso_hoje, lista curta de exercícios (nomes) |

**Não incluir:** API keys, dados de outros alunos, dumps financeiros completos, prompts internos, histórico ilimitado de mensagens (últimas N da sessão, ex. 10).

---

## 4. Tool registry

Cada tool:

```js
{
  name: 'complete_meal',
  description: '...',
  autonomy: 2,
  inputSchema: z.object({ ... }),
  idempotent: true,
  reversible: true,          // uncomplete_meal
  execute: async (ctx, args) => { ... }
}
```

`ctx = { pool, aluno, userId, coachId, runId, autonomyMax, origin }`

### 4.1 Catálogo Phase 1b (implementar wrappers)

| Tool | Autonomia | Service subjacente |
|------|-----------|--------------------|
| `get_student_context` | 0 | context-builder |
| `get_today_plan` | 0 | aluno-hoje |
| `get_next_action` | 0 | proxima-acao |
| `get_today_workout` | 0 | aluno-hoje / effective-workout |
| `get_meal_detail` | 0 | dieta + itens |
| `list_substitutions` | 0 | `/alimentos/:id/substituicoes` logic |
| `complete_meal` | 2 | refeicao-conclusao |
| `uncomplete_meal` | 2 | refeicao-conclusao |
| `log_workout_set` | 2 | treino-sessao |
| `complete_workout_session` | 2 | treino-sessao |
| `log_body_weight` | 2 | body-metrics |
| `open_ui` | 2 | retorna deep-link tipado (sem side-effect server) |
| `schedule_reminder` | 2 | smart-reminder / notification (se seguro) |
| `draft_message_to_coach` | 3 | cria `agent_approvals` pending — **não envia** |

**Registadas mas blocked por policy (nível 4):** `modify_diet`, `modify_workout`, `change_financial_status`, `suspend_access` — existem no registry só para o orquestrador saber recusar com mensagem clara (ou omitidas do prompt de tools disponíveis).

### 4.2 Contrato de output de tool

```json
{
  "ok": true,
  "data": {},
  "ui_hints": [
    { "type": "action_card", "title": "...", "actions": [] }
  ]
}
```

---

## 5. Policy de autonomia

```text
request.autonomyMax (default 2 para aluno)
        ↓
tool.autonomy > autonomyMax → deny + agent_decisions
tool nível 3 → requer approval record (não auto-executar)
tool nível 4 → sempre deny
aluno bloqueado → deny WRITE/ACTION excepto open_ui para ecrãs de bloqueio
```

---

## 6. Orchestrator

### 6.1 Fluxo

```text
1. Abrir/continuar session
2. Persistir user message
3. Criar agent_run
4. buildStudentAgentContext
5. Se intent trivial mapeável deterministicamente (ex. "concluí" + next_meal):
     → executar tool directa (fast path, sem LLM)
6. Senão:
     → LLM structured output: { assistant_text, tool_calls[], cards[] }
7. Para cada tool_call (cap 5):
     → policy → execute → log agent_tool_calls → refresh context se WRITE
8. Persistir assistant message + cards
9. Fechar run (tokens, latency)
```

### 6.2 Structured output (schema)

```json
{
  "intent": "next_action|next_meal|today_workout|complete|late|restaurant|other|refuse",
  "assistant_text": "string pt-BR",
  "tool_calls": [
    { "name": "complete_meal", "args": {} }
  ],
  "cards": [
    {
      "id": "string",
      "title": "string",
      "body": "string",
      "primary_action": { "type": "tool|open_ui", "name": "...", "args": {} },
      "secondary_action": null
    }
  ]
}
```

Validar com Zod antes de executar. Se inválido → fallback determinístico via `get_next_action`.

### 6.3 Fast path (obrigatório)

Intents com regex/classificador leve **sem LLM** quando possível:

- “concluí” / “feito” / “done” → `complete_meal` ou avançar treino conforme `proxima_acao`
- “treino” / “treinar” → `get_today_workout` + card
- “refeição” / “comer” → `get_next_action` meal
- “restaurante” → card `open_ui` meal photo

Reduz custo e latência; LLM para frases ambíguas.

### 6.4 Providers

Reutilizar `AIProviderManager` (`server/services/ai/`). Extensões mínimas:

- `generateStructuredJson({ system, user, schemaHint, timeout })`
- retry 1x em erro transitório
- timeout configurável (ex. 20s texto)
- devolver `usage` se o SDK fornecer; senão estimar

---

## 7. APIs HTTP

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/agent/sessions` | Cria sessão (`channel=student_hoje`) |
| `GET` | `/api/agent/sessions/current` | Sessão open do dia / recente |
| `POST` | `/api/agent/sessions/:id/messages` | Envia intent → run → resposta |
| `GET` | `/api/agent/sessions/:id/messages` | Histórico |
| `POST` | `/api/agent/approvals/:id/decide` | approve/reject (nível 3) |
| `GET` | `/api/agent/runs/:id` | Debug/audit (aluno own / coach scoped) |

Auth: aluno self; admin bypass; coach só leituras de alunos seus (fase posterior se necessário).

Rate limit dedicado: ex. `agentIntentLimiter` 30/hora/user (env configurável).

Contrato: adicionar a `src/contracts/api-contract.ts`.

---

## 8. Observabilidade

- Winston: `logAgentRun({ runId, intent, tools, ms, tokens })`
- Persistir sempre `agent_runs` + `agent_tool_calls`
- Métricas mínimas exportáveis via query SQL / endpoint admin opcional
- Sem PII excessivo nos logs de ficheiro (preferir ids)

---

## 9. Segurança

| Controlo | Detalhe |
|----------|---------|
| Scope | `aluno_id` do JWT; nunca confiar em args cross-tenant |
| Allowlist context | Campos fixos |
| Tool args | Zod; strip unknown |
| Prompt | System fixo versionado; user content em bloco separado |
| HIGH IMPACT | Não expostas no prompt de tools do aluno |
| Bloqueio acesso | Context inclui flags; policy bloqueia WRITE |
| Sanitização audit | Truncar content longo; não guardar imagens base64 em `agent_*` |

---

## 10. Testes

| Suite | Cobertura |
|-------|-----------|
| `policy.test.js` | deny nível 4; cap autonomia |
| `tool-registry.test.js` | dispatch + zod fail |
| `context-builder.test.js` | allowlist; sem leak |
| `orchestrator.fastpath.test.js` | “concluí” → complete_meal |
| `agent.routes.test.js` | auth + rate + happy path mock LLM |

Mock do provider AI nos testes (não chamar rede).

---

## 11. Critérios de aceite Phase 1b

1. Sessão + mensagem criam `agent_run` com tool calls persistidos.
2. Fast path “concluí” grava `refeicao_conclusoes` sem LLM.
3. Pedido NL para “altera minha dieta” → refuse + `agent_decisions`.
4. Tool com args inválidos não executa side-effect.
5. Tokens/latency registados quando disponíveis.
6. Rate limit específico activo.
7. Documentação de tools no registry alinhada a esta spec.

---

## 12. Fora de escopo (1b)

- Intent bar UI no portal (Phase 2)
- Streaming SSE (pode ser follow-up)
- Coach Agent
- Vector memory
- Extracção completa de `api.js` (só o necessário às tools)

---

*Spec técnica Phase 1b. Implementação em etapa de código separada.*
