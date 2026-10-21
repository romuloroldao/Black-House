# Agent-First Portal — as-built

| Campo | Valor |
|-------|--------|
| **Data** | 2026-07-26 |
| **Âmbito** | Portal aluno — Agent Home como experiência principal |
| **Flag** | `VITE_AGENT_DAILY_ENABLED` (default ligado; off = home clássica) |

## Resumo

A tab `?tab=hoje` passou a ser a **Agent Home híbrida**: saudação, próxima acção, faixa de contexto do dia, conversa inline (composer + thread + chips + action cards), e navegação tradicional preservada (sidebar, bottom nav, FAB «Agente»).

## Camadas

```text
Aluno
  ├─ Agent Home (tab=hoje)  → intenção + próxima acção + execução
  └─ Navegação tradicional (?tab=*) → mesmos dados/APIs
```

## Componentes novos / adaptados

| Peça | Path |
|------|------|
| Home | `src/components/student/StudentTodayView.tsx` |
| Composer | `src/components/student/agent/AgentComposer.tsx` |
| Thread | `src/components/student/agent/AgentThread.tsx` |
| Próxima acção | `src/components/student/agent/NextActionHero.tsx` |
| Faixa Hoje | `src/components/student/agent/TodayContextStrip.tsx` |
| FAB retorno | `src/components/student/agent/AgentReturnFab.tsx` |
| Peso | `src/components/student/agent/WeightLogDialog.tsx` |
| Chips | `src/components/student/agent/agent-chips.ts` |
| Hook | `src/hooks/useStudentAgent.ts` (hydrate + peso + resume) |
| Analytics | `src/lib/agent-analytics.ts` |
| Portal + FAB | `src/pages/StudentPortal.tsx` |

## Backend (extensões)

- `open_ui` targets: `progress`, `progress_photos`, `reports`, `videos`, `profile`
- Fast paths: `ask_weight`, `log_weight`, `open_progress`, `open_reports`, `open_videos`, `open_checkin`, `resume` (via «Voltei»)

## Continuidade

Ao navegar via action card (`open_ui`), grava-se `sessionStorage.bh-agent-resume`. Ao regressar a `hoje`, o agente pergunta «Voltei. O que faço agora?».

## Métricas

Eventos `blackhouse:agent-analytics`: `agent_home_view`, `agent_intent_sent`, `agent_card_action`, `nav_traditional_open`, `agent_return`, `agent_hydrate`, `agent_error`.

## Testes

- Unit: `server/tests/agent-foundation.test.js` (weight/progress/checkin)
- E2E: `e2e/tests/student/agent-home.spec.ts`

## Não feito (fase 6 parcial)

- Streaming LLM (fast path cobre intents MVP)
- Preferência persistente de última tab
