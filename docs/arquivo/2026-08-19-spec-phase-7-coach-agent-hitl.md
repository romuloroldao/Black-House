# Spec Phase 7 — Coach Agent HITL (ciclo 7a)

**Data:** 2026-08-19  
**Âmbito:** carteira de aderência 7d, UI de `coach_rules`, sessão de treino com servidor como fonte de verdade, ranking determinístico da inbox, rascunhos HITL de check-in  
**Fora deste ciclo (7b):** orquestrador LLM do coach, vector KB, voz, OFF, lista de compras, RBAC de assistente, tab Análises, envio autónomo, `modify_diet` / `modify_workout`, financeiro

## Objectivo

Dar ao coach uma **carteira accionável** e um **inbox ordenado por pesos fixos**, com rascunhos de check-in que o humano edita e grava. Sem agente autónomo do coach.

## Entregue

### A — Carteira de aderência 7d
- `GET /api/coach/me/adherence-carteira?days=7`
- Agregação em lote (refeições, treinos, agenda, check-ins pendentes, `task_adherence_events`) — **sem N+1**
- Reutiliza `computeWindowMetrics` do insight 7d (`behavioral-insight.service`)
- Uma superfície: cartão no Dashboard do coach, deep-link `/alunos/:id`
- Pesos (servidor + cliente alinhados): check-in pendente **40** + misses×**8** (teto **40**) + dieta &lt;40% **20** + treino &lt;50% **15**

### B — UI `coach_rules`
- Tab **Método** em Definições (`CoachRulesManager`)
- Listar / criar / editar / desactivar
- Campos: domain, trigger, priority, title, body (≤500)
- Sem embeddings, sem knowledge base
- API já existente: `server/routes/coach-rules.js`

### C — Sessão de treino: servidor é a verdade
- Hidratação GET de `treino_sessoes` / séries (`hydrateWorkoutSessionFromServer` / `loadWorkoutSessionFromServer`)
- `localStorage` só como resume de UI com TTL ~2h — **não** é métrica
- Listagem de treinos: **GET only** (não cria sessão ao ver a lista)
- Ecrã guiado pode `POST` start

### D — Ranking determinístico da inbox
- `CoachCheckinInbox` junta aderência 7d + check-in pendente
- Filtro `queda_aderencia` / «Queda de execução 7d»
- `compareInboxForTriagem` — pesos testáveis, **sem LLM** no ranking

### E — HITL de rascunhos de check-in
- `POST /api/weekly-checkins/:id/ai/draft-response` inclui insight 7d + `coach_rules` (triggers `checkin` / `always`)
- O coach vê, edita e grava
- **Não há envio autónomo** (`autonomous_send: false`)

## Explicitamente 7b (não este ciclo)

Orquestrador LLM do coach, tools `modify_diet` / `modify_workout`, envio autónomo, vector KB.

## Contrato HTTP

- Path: `/api/coach/me/adherence-carteira` em `src/contracts/api-contract.ts`
- Cliente: `apiClient.getAdherenceCarteiraSafe(7)`

## Testes

- `server/tests/adherence-carteira.test.js` — pesos, queda 7d, `compareInboxForTriagem`, métricas da janela
