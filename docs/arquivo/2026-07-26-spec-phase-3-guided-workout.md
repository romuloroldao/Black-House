# Spec Phase 3 — Guided Workout (as-built)

**Data:** 2026-07-26  
**Âmbito:** portal aluno apenas  
**Dependências:** Phase 1a (`treino_sessoes` / `treino_serie_logs`)

## Objectivo

Conduzir o aluno exercício a exercício e série a série, com log de carga, reps, RPE e dor, sincronizado com o servidor.

## Entregue

### UI (`StudentWorkoutSessionView`)
- Fluxo por exercício com N séries prescritas (`parsePrescribedSets`)
- Campos por série: carga, reps, RPE, dor
- Descanso entre séries vs entre exercícios
- Conclusão de sessão → `status: completed` + adherence event

### Sync (`workout-session-utils`)
- `ensureServerWorkoutSession` + `syncWorkoutSerieToServer` com `set_index`, `repeticoes`, `rpe`, `dor`
- Histórico de cargas hidratado do servidor

### Agente
- Chip «Iniciar treino» → intent `start_workout` → `open_ui` `treino_sessao`
- Card de treino do dia com CTA sessão guiada
- «Concluí» com `proxima_acao.type === today_workout` abre sessão
- Deep-link `?tab=workouts&session=1` em `StudentWorkoutsView`

## Fora de âmbito (fases seguintes)
- Progressão automática de cargas sugerida pelo agente
- Substituições / nutrição contextual (Phase 4)
- Coach Agent (Phase 7)
