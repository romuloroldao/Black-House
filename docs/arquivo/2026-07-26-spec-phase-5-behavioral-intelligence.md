# Spec Phase 5 — Behavioral Intelligence (as-built)

**Data:** 2026-07-26  
**Âmbito:** portal aluno (+ job server-side)  
**Dependências:** Phase 1a execução (`refeicao_conclusoes`, `treino_sessoes`, `task_adherence_events`)

## Objectivo

Transformar execução registada em **insight accionável** (streak / misses / taxas) no Hoje e no Daily Agent, e fechar o dia com eventos `missed` para meal/workout.

## Entregue

### Service
- `server/services/behavioral-insight.service.js`
  - `getBehavioralInsight` — janela 7 dias, streak, miss_days, rates meal/workout, texto + tone
  - `recordDailyMisses` — INSERT `task_adherence_events` outcome=`missed`

### Job
- `DailyAdherenceJob` — cron 23:10 (hoje) e 00:20 (ontem)

### API / Agente
- `GET /api/alunos/me/hoje` → `behavioral_insight`
- Tool READ `get_behavioral_insight`
- Intent «Como estou?» no sheet

### UI
- `BehavioralInsightCard` no `StudentTodayView`

## Fora de âmbito
- Push proactivo / domains smart-reminder meal|workout
- Dashboard coach de aderência (API `task-adherence` já existe)
- Coach Agent (Phase 7)
- Phase 6 coach_rules / KB
