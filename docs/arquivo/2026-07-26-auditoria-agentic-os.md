# Auditoria e Arquitectura — Black House Agentic Operating System

| Campo | Valor |
|-------|--------|
| **Produto** | Black House |
| **Documento** | Relatório de investigação / arquitectura (não implementação) |
| **Data** | 2026-07-26 |
| **Fontes** | Código em `/root`, [`ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md), [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md) |
| **Âmbito** | Viabilidade da transformação agentic; gaps; roadmap |
| **Fora de âmbito** | Alteração de código de produto; pasta `.worktrees/checkpoint/` |

Documentos complementares desta entrega:

- PRD Agentic: [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md)
- Spec Phase 1a (execução diária): [`2026-07-26-spec-phase-1a-execucao-diaria.md`](2026-07-26-spec-phase-1a-execucao-diaria.md)
- Spec Phase 1b (foundation): [`2026-07-26-spec-phase-1b-agent-foundation.md`](2026-07-26-spec-phase-1b-agent-foundation.md)
- Spec Phase 2 (Daily Agent): [`2026-07-26-spec-phase-2-daily-agent.md`](2026-07-26-spec-phase-2-daily-agent.md)

---

## 1. Executive Summary

### Conclusão

A transformação da Black House num **Sistema Operacional Agentic de Acompanhamento Personalizado** é **viável de forma incremental**. Não exige reescrita da plataforma. Exige três capacidades novas:

1. **Persistir a execução diária no servidor** (hoje checklist de refeição e log de treino estão só em `localStorage`).
2. **Camada de tools** sobre serviços de domínio existentes (nunca SQL livre pelo LLM).
3. **Orquestrador agentic** novo — a IA actual é apenas request-response (PDF, foto de refeição, rascunhos de check-in).

### Em que condições

- Manter stack canónica: React/Vite + Express + PostgreSQL + JWT + Socket.io.
- Tratar LLM como NLU/planeamento/copy/vision — não como base de dados.
- Autonomia limitada (níveis 0–2 no MVP aluno; HIGH IMPACT sempre humano).
- Extrair services só nas áreas tocadas pelas tools (não “big bang” em `routes/api.js`).

### Maior risco

Construir um “assistente” sobre um **falso contexto**: o ecrã Hoje conhece dieta/treino, mas o sistema **não sabe** se o aluno concluiu refeições ou séries. Sem telemetria server-side, o agente alucina aderência e a hipótese “zero navegação” não se valida.

### Recomendação

```text
Phase 1a — Persistência de execução
    → Phase 1b — Agent Foundation
        → Phase 2 — Daily Agent MVP
            → Guided Workout → Nutrição contextual → Coach Agent
```

Coach Agent e knowledge base **depois** da validação com alunos.

---

## 2. Estado actual

### 2.1 Frontend

| Aspecto | Realidade | Path |
|---------|-----------|------|
| Framework | React 18 + Vite 5 + TypeScript + React Router v6 | `package.json`, `src/App.tsx` |
| Coach | `AppLayout` + sidebar de módulos | `src/components/AppLayout.tsx` |
| Aluno | `StudentPortal` mobile-first (`/portal-aluno/*`) | `src/pages/StudentPortal.tsx` |
| Auth | JWT em storage seguro; `AuthContext` | `src/contexts/AuthContext.tsx` |
| Bootstrap | State machine identidade → contexto | `src/contexts/DataContext.tsx` |
| API | `apiClient` + contrato tipado | `src/lib/api-client.ts`, `src/contracts/api-contract.ts` |
| Realtime | Socket.io client | `src/hooks/useWebSocket.ts` |
| Estado global | React Context (sem Zustand) | — |

**UX de execução já existente (reutilizável):**

- `StudentTodayView` — agregação “o que faço hoje”
- `StudentDietView` — checklist + substituições + macros
- `StudentWorkoutSessionView` — sessão guiada + timer
- `MealPhotoLogSheet` — refeição livre com IA
- `StudentWeeklyCheckin` — wizard 5 secções
- `MessageManager` — chat 1:1

### 2.2 Backend

| Aspecto | Realidade | Path |
|---------|-----------|------|
| Entrypoint | Express + Pool + WS + Jobs | `server/index.js` |
| Router principal | ~6.8k linhas; muita lógica inline | `server/routes/api.js` |
| Services desacoplados | Parcial (~10 services callable) | `server/services/*.service.js` |
| Repositories | 7 ficheiros; queries directas ainda comuns | `server/repositories/` |
| Auth/RBAC | JWT + `validateRole` + payment/access guards | `server/middleware/` |
| Jobs | `node-cron`; sem DLQ formal | `server/jobs/` |
| Financeiro | Asaas + sync + audit | `server/financial/` |
| Testes | ~8 ficheiros `node:test` | `server/tests/` |

**Services imediatamente reutilizáveis por tools:**

- `getAlunoHoje(pool, { aluno, userId })` — `server/services/aluno-hoje.service.js`
- `resolveEffectiveWorkout` — `server/services/effective-workout.service.js`
- `DietService`, `body-metrics`, `refeicoes-registradas`, `FoodMatchingService`
- `AIProviderManager` — `server/services/ai/index.js`
- `NotificationService`, smart-reminder engine

### 2.3 Base de dados

Schema canónico: `schema_adaptado_postgres.sql` (+ migrações em `server/migrations/`).

| Categoria | Tabelas representativas | Tipo |
|-----------|-------------------------|------|
| Core | `alunos`, `dietas`, `itens_dieta`, `treinos`, `alunos_treinos`, `aluno_treino_agenda` | Estado |
| Comunicação | `conversas`, `mensagens`, `avisos`, `notificacoes` | Estado + eventos |
| Progresso | `weekly_checkins`, `fotos_alunos`, `aluno_peso_historico` | Histórico |
| Execução livre | `refeicoes_registradas`, `refeicao_registrada_itens` | Eventos |
| Aderência | `task_adherence_events` (só `checkin_weekly` activo) | Eventos |
| Financeiro | `asaas_*`, `financial_sync_inbox`, `financial_audit_log`, `student_access_state` | Estado + audit |
| Auth | `app_auth.users`, `user_roles` | Estado |

**Não existem:** `agent_*`, `refeicao_conclusoes`, `treino_serie_logs`.

### 2.4 Camada de IA (as-built)

| Feature | Status | Endpoint / serviço |
|---------|--------|-------------------|
| Import PDF | ✅ | `POST /api/import/parse-pdf` → import-engine + `ai.service.js` |
| Foto refeição | ✅ | `POST /api/refeicoes-registradas/analyze` → Gemini vision |
| Trends check-in | ✅ | `POST /api/weekly-checkins/ai/trends-summary` |
| Draft check-in | ✅ | `POST /api/weekly-checkins/:id/ai/draft-response` |
| Tool-calling | ❌ | — |
| Streaming | ❌ | — |
| Memória / sessão agente | ❌ | — |
| Cost/token tracking | ❌ | — |

Providers: Groq / Gemini / OpenAI com fallback (`AI_PROVIDER`, `AI_PROVIDER_FALLBACK`). Vision: Gemini apenas.

### 2.5 Capacidade âncora

`GET /api/alunos/me/hoje` já devolve contexto do dia (aluno, dieta + rotação A/B, treino/agenda/descanso, pendências, streak, eventos, fotos). É a base READ do Daily Agent — **mas não inclui** conclusão de refeições nem progresso de treino.

### 2.6 Gap crítico verificado

| Capacidade | UI | BD | API | Agente pode usar? |
|------------|----|----|-----|-------------------|
| Marcar refeição feita | ✅ | ❌ localStorage | ❌ | ❌ |
| Log carga/série treino | ✅ parcial | ❌ localStorage | ❌ | ❌ |
| Treino do dia | ✅ | ✅ agenda | ✅ hoje | ✅ |
| Refeição livre foto | ✅ | ✅ | ✅ | ✅ |
| Substituições | ✅ lista | ❌ escolha não persiste | GET only | ⚠️ parcial |
| Próxima acção | ❌ | ❌ | ❌ | ❌ |

Confirmação no PRD as-built: NUT-A03 e TRN-A04 documentam explicitamente persistência local.

---

## 3. Capabilities reutilizáveis

| Capability | Reuso agentic | Esforço |
|------------|---------------|---------|
| `getAlunoHoje` | Context builder / `get_today_plan` | Baixo |
| Agenda `aluno_treino_agenda` | `get_today_workout` | Baixo |
| `refeicoes_registradas` + meal photo AI | `save_meal_photo_analysis`, restaurante | Baixo |
| Equivalência alimentar API | `list_substitutions` | Baixo |
| Check-in + AI draft/trends | Coach Agent (fase 7); leitura no Daily | Médio |
| Providers AI + JSON mode | Orquestrador structured output | Médio |
| RBAC + access guards | Policy de tools | Baixo |
| Socket.io + notificações | Push pós-acção / reminders | Baixo |
| `task_adherence_events` | Expandir domains meal/workout | Médio |
| UI Hoje / Dieta / Sessão / Foto | Action cards + deep-links | Médio |
| Financial access engine | Bloquear agente se aluno sem acesso | Baixo |

---

## 4. Gaps

| Gap | Impacto | Fase |
|-----|---------|------|
| Execução diária só client-side | Bloqueia hipótese agentic | **1a** |
| Sem “próxima acção” determinística | Agente não sabe o que priorizar | 1a + 2 |
| IA sem tool loop / sessão / audit | Não há agente, só helpers | **1b** |
| CRUD monólito em `api.js` | Tools difíceis de testar | 1b (extrair o necessário) |
| Sem observabilidade de tokens/custo | Risco financeiro e debug | 1b |
| Substituição não persistida | Nutrição contextual incompleta | 4 |
| Log treino sem reps/RPE estruturados | Guided Workout frágil | 1a + 3 |
| Sem `coach_rules` / KB | Filosofia do coach não operacional | 6 |
| Testes insuficientes | Regressão em foundation | 1a/1b |
| Rate limit genérico em check-in AI | Abuso / custo | 1b |

---

## 5. Infraestrutura

| Área | Classificação | Nota |
|------|---------------|------|
| PostgreSQL / domínio | 🟢 Pronto | Novas tabelas; sem mudança de motor |
| Auth / RBAC / tenant | 🟢 Pronto | Reaplicar guards em cada tool |
| AI providers | 🟡 Adaptação | Structured output ok; falta retry, cost, streaming |
| Jobs / cron | 🟡 Adaptação | OK lembretes; falta fila de agent runs / DLQ |
| Realtime | 🟡 Adaptação | Push; não substitui tool loop |
| Storage / vision | 🟢 Pronto | Pipeline foto refeição existe |
| Observabilidade agente | 🔴 Mudança significativa | Traces, tokens, decisões |
| Execução diária | 🔴 Mudança significativa | localStorage → PG |
| Monólito rotas | 🟡 Adaptação | Extracção gradual por tool |
| Testes | 🔴 Mudança significativa | Cobertura foundation obrigatória |

**Latência alvo:**

| Operação | Modo |
|----------|------|
| Intent + 1–2 tools READ/WRITE | Síncrono + streaming de texto |
| Vision (foto cardápio/refeição) | Async / job curto |
| Import PDF | Já async no fluxo coach |
| Loop agente | Hard cap (ex. 5 tool calls / run) |

---

## 6. Arquitectura proposta

### 6.1 Princípios

1. **Intenção ≠ chat-only** — NL + toques + cards; UI especializada quando superior.
2. **Determinístico primeiro** — contexto e “próxima acção” em código; LLM interpreta e explica.
3. **Tools controladas** — sem acesso irrestrito à BD.
4. **Um orquestrador** no MVP — skills especializadas depois, não multi-agente caótico.
5. **Incremental** — não reescrever o portal; acrescentar intent surface no Hoje.

### 6.2 Diagrama

```text
┌─────────────────────────────────────────────┐
│  EXPERIÊNCIA                                │
│  Intent bar · Action cards · Dieta · Treino │
│  Foto · Check-in · Progresso · Chat humano  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  INTENT API                                 │
│  agent_sessions · context builder · policy  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  ORCHESTRATOR                               │
│  NLU → plano → tool loop (cap) → resposta   │
│  structured output (sem lock-in FC nativo)  │
└────────────────────┬────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      READ tools  WRITE tools  ACTION (gated)
         │           │           │
         └───────────┼───────────┘
                     ▼
┌─────────────────────────────────────────────┐
│  DOMAIN SERVICES (existentes + novos)       │
│  aluno-hoje · execução · dieta · treino     │
│  refeições · check-in · AI · notifications  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
              PostgreSQL
```

### 6.3 Relação com o produto actual

```text
PRD as-built (2026-07-25)
        ↓
Estado existente (código)
        ↓
Esta auditoria + PRD Agentic (2026-07-26)
        ↓
Estado futuro (fases 1a → 7)
```

---

## 7. Modelo de agentes

### 7.1 Definição formal

Um **agente** na Black House:

```text
Observar contexto → Interpretar intenção → Raciocinar/planear
→ Usar tools permitidas → Executar → Observar resultado → Actualizar contexto
```

Não é sinónimo de chatbot.

### 7.2 Decisão arquitectural

| Alternativa | Decisão |
|-------------|---------|
| Agente único monolítico | ❌ | Mistura domínio e permissões |
| Multi-agente paralelo dia 1 | ❌ | Complexidade sem evidência |
| **Orquestrador + tool layer + skills** | ✅ | MVP simples; extensível |
| Workflow engine pesado | ❌ no MVP | Jobs actuais bastam no início |

**Skills futuras (mesmo orquestrador):** Nutrition, Training, Progress, Coach — activadas por router de intenção, não por processos autónomos sem policy.

### 7.3 Componentes

| Componente | Responsabilidade |
|------------|------------------|
| Context builder | Monta snapshot determinístico (hoje + execução + perfil) |
| Orchestrator | Interpreta intent, escolhe tools, gera resposta/cards |
| Tool registry | Catálogo tipado (Zod), autonomia, idempotência |
| Autonomy policy | Níveis 0–4; bloqueia HIGH IMPACT |
| Session store | Mensagens + runs + tool calls |
| UI bridge | Action cards / deep-links para ecrãs existentes |

### 7.4 Memória

| Camada | Store | Quando |
|--------|-------|--------|
| Contexto actual | PG estruturado + cache request | Sempre |
| Histórico longitudinal | Tabelas existentes + logs execução | Sempre |
| Sessão | `agent_sessions` / `agent_messages` | Por conversa |
| Decisões / audit | `agent_decisions`, `agent_tool_calls` | Sempre |
| Regras coach | `coach_rules` | Fase 6 |
| KB semântica | Vector opcional | Fase 6 só se necessário |

Embeddings **não** substituem checklist, cargas ou RBAC.

### 7.5 Catálogo de tools (visão)

Ver specs 1b e 2. Resumo:

- **READ 0:** contexto, plano do dia, próxima acção, treino, refeição, check-ins, substituições
- **WRITE 2:** concluir refeição, log série, concluir sessão, peso, guardar análise foto
- **ACTION 2–3:** `open_ui`, reminder, rascunho mensagem (aprovação)
- **HIGH IMPACT 4:** dieta/treino/financeiro/acesso/fármacos — proibido ao aluno-agent

---

## 8. Modelo de dados

### 8.1 Existente e aproveitável

- Estado: `alunos`, `dietas`, `itens_dieta`, `alunos_treinos`, `aluno_treino_agenda`, `student_access_state`
- Histórico: `weekly_checkins`, `aluno_peso_historico`, `fotos_alunos`, `refeicoes_registradas`
- Eventos/audit: `task_adherence_events`, `financial_audit_log`, `*_dispatches`

### 8.2 Novo — Phase 1a (execução)

- `refeicao_conclusoes`
- `treino_sessoes`
- `treino_serie_logs`

Detalhe: [`2026-07-26-spec-phase-1a-execucao-diaria.md`](2026-07-26-spec-phase-1a-execucao-diaria.md)

### 8.3 Novo — Phase 1b (agente)

- `agent_sessions`, `agent_messages`, `agent_runs`, `agent_tool_calls`, `agent_decisions`, `agent_approvals`

Detalhe: [`2026-07-26-spec-phase-1b-agent-foundation.md`](2026-07-26-spec-phase-1b-agent-foundation.md)

### 8.4 Depois

- `coach_rules`, `student_patterns` (derivados), vector store opcional

---

## 9. Segurança

| Ameaça | Mitigação |
|--------|-----------|
| SQL livre pelo LLM | Proibido; só tools |
| Cross-aluno / cross-coach | Scope em cada tool (`aluno_id` do JWT; `assertCoachCanAccessAluno`) |
| Prompt injection | Args Zod; system prompt isolado; user content nunca vira instrução de tool sem validação |
| Tool abuse | Rate limit + autonomia + audit |
| Escalada de privilégio | HIGH IMPACT gated; role checks |
| Exfiltração | Context builder com allowlist de campos; sem dumps de tabelas |
| Secrets | Já em `server/.env`; providers keys nunca no frontend |
| Aluno bloqueado | Respeitar ACC-01/ACC-02 antes do orchestrator |

Auditoria: cada `agent_tool_calls` com input/output sanitizado, actor, autonomia, resultado, latência, tokens.

---

## 10. PRD complementar

Necessário. O PRD as-built descreve o produto actual; não a visão OS agentic.

Criado em: [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md)

Não substitui [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md).

---

## 11. Roadmap

| Fase | Capacidade | Dependência |
|------|------------|-------------|
| **0** | Discovery (este doc) + decisões | — |
| **1a** | Daily Execution Persistence | Bloqueante |
| **1b** | Agent Foundation | Pode paralelizar com 1a após schema execução mínimo |
| **2** | Daily Agent MVP | 1a + 1b |
| **3** | Guided Workout agentic | 1a treino |
| **4** | Contextual Nutrition | WRITE + vision + substituição persistida |
| **5** | Behavioral Intelligence | Eventos execução + jobs |
| **6** | Coach Knowledge | `coach_rules` (+ KB se preciso) |
| **7** | Coach Agent (HITL) | 6 + check-in AI |

Ordem revista: **persistência antes** do Daily Agent.

---

## 12. MVP recomendado

**Daily Agent** no portal aluno (intent bar no Hoje + action cards).

Valida: *“O aluno executa o plano com menos navegação e mais orientação contextual.”*

Inclui intents: o que faço agora / próxima refeição / treino hoje / concluí / atrasado / restaurante→foto.

Fora: multi-agente, alterar planos, coach agent, voz, vector KB, redesign total.

Detalhe: [`2026-07-26-spec-phase-2-daily-agent.md`](2026-07-26-spec-phase-2-daily-agent.md)

---

## 13. Riscos

| Tipo | Risco | Mitigação |
|------|-------|-----------|
| Técnico | Monólito `api.js` atrasa tools | Extrair só services das tools MVP |
| Técnico | Custo LLM | Quotas; preferir rotas determinísticas |
| Produto | Chatbot genérico sem valor | MVP focado em execução do plano |
| IA | Respostas incorrectas sobre plano | Context builder determinístico; LLM não inventa macros |
| Segurança | Tool WRITE abusada | Idempotência, scope, rate limit, audit |
| UX | Mais um sítio para “falar” | Intent no Hoje; zero tab nova no MVP |
| Dados | Migração localStorage | Dual-write curto + fallback read |
| Operação | Sem traces | Observabilidade mínima na 1b |

---

## 14. Decisões recomendadas

| # | Decisão | Recomendação |
|---|--------|--------------|
| 1 | Persistência execução no mesmo epic da foundation | **Sim** — bloqueante |
| 2 | Tool-calling nativo do provider vs orquestrador próprio | **Orquestrador + structured JSON** (menos lock-in) |
| 3 | Surface UX | **Intent bar no Hoje + bottom sheet** |
| 4 | Horários de refeição | **Ordem canónica + relógio**; `horario` opcional depois |
| 5 | Escopo MVP | **Só aluno** |
| 6 | Autonomia WRITE no MVP | Níveis 0–2; mensagens nível 3 |
| 7 | Vector DB | **Não** no MVP |

---

## 15. Próximos passos concretos

1. ✅ Relatório de auditoria (este documento).
2. ✅ PRD Agentic complementar.
3. ✅ Specs Phase 1a, 1b e 2.
4. Implementar Phase 1a (schema + APIs + migrar UI localStorage) — *próxima etapa de código*.
5. Implementar Phase 1b (sessions, orchestrator, tools, policy, logs).
6. Implementar Phase 2 (Daily Agent) e medir métricas do PRD.
7. Só então abrir Phase 3+.

---

## Anexo A — Matriz de verificação (amostra)

| Capacidade | Existe código? | Integrada? | Funcional? | Testes? | Reutilizável por agente? |
|------------|----------------|------------|------------|---------|--------------------------|
| `/api/alunos/me/hoje` | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Checklist refeição | ✅ UI | ❌ BD | ✅ local | ❌ | ❌ |
| Sessão treino / cargas | ✅ UI | ❌ BD | ✅ local | ❌ | ❌ |
| Meal photo AI | ✅ | ✅ | ✅ | ✅ schema | ✅ |
| Check-in AI draft | ✅ | ✅ | ✅ | ⚠️ | ✅ coach |
| Chat Socket.io | ✅ | ✅ | ✅ | ⚠️ | ⚠️ bridge UI |
| Smart reminders | ✅ | ✅ | ✅ parcial | ✅ engine | ✅ jobs |
| Substituições | ✅ | ⚠️ | ✅ lista | ❌ | ⚠️ READ only |
| Agent orchestrator | ❌ | — | — | — | — |

---

## Anexo B — Matriz de autonomia

| Nível | Nome | Exemplos | MVP aluno |
|-------|------|----------|-----------|
| 0 | Leitura | Consultar plano, treino, refeição | ✅ |
| 1 | Sugestão | Substituto, copy de orientação | ✅ |
| 2 | Escrita baixo risco | Concluir refeição, log série, peso | ✅ |
| 3 | Com aprovação | Enviar mensagem ao coach; propor ajuste | Parcial (draft) |
| 4 | Humano / proibido | Alterar dieta/treino; financeiro; acesso; fármacos | ❌ |

---

*Investigação baseada no código e no PRD as-built em 2026-07-26. Actualizar este documento se o código divergir.*
