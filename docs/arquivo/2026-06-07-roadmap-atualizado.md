# Roadmap actualizado — 2026-06-07

**Base:** `docs/arquivo/2026-05-26-roadmap-pos-validacao.md`  
**Contexto:** QA E2E (`docs/arquivo/2026-06-07-backlog-qa-e2e-blackhouse.md`)

---

## Estado geral

| Área | Estado |
|------|--------|
| Import P1 (excepto lote) | ✅ |
| Check-in coach 001–015 | ✅ |
| Polish pós-MVP portal | ✅ |
| **Fase 1 realtime aluno** (check-in respondido + dieta) | ✅ |
| **Fase 2 realtime coach** (novo check-in semanal) | ✅ |
| **BH-QA-006** rotas `/api/treinos` | ✅ |
| Fase 4 polish (a11y 4.5 + piloto 5 alunos 4.6) | 🟡 em curso |
| Import em lote | ⏸️ pausado |

---

## Fase 1 realtime aluno — ✅

- Backend: `notifyCheckinRespondido`, `notifyDietaAtualizada` → Socket.io `user:{id}`
- Frontend: `useStudentPortalRealtime` no `StudentPortal`
- Eventos: `notification`, `checkin:respondido`, `dieta:atualizada`

---

## Fase 2 realtime coach — ✅ (2026-06-07)

**Objectivo:** coach vê novo check-in semanal quase em tempo real (badge, inbox, toast).

### Backend

- `websocket.service.js`: auth alinhada com HTTP (`resolveEffectiveRole` + `getAlunoRecordForAuthUser`); sala `coach:{userId}` para coach/admin
- `notification.service.js`: `notifyUser` emite `new_weekly_checkin` na sala `user:{coachUserId}`

### Frontend

- `useCoachPortalRealtime` em `AppLayout` (substitui polling 25s)
- `CoachCheckinInbox` escuta `blackhouse:checkin-pending-updated` e `blackhouse:coach-realtime`
- Fallback: polling 120s **só** se socket desligado (badge, sem toast duplicado)

### QA

- **BH-QA-005** — fechado com esta entrega (reteste: aluno envia check-in → coach vê toast + inbox actualiza sem F5)

---

## Backlog QA aberto

| ID | Item | Estado |
|----|------|--------|
| BH-QA-001 | GRANT `educational_contents` | ✅ |
| BH-QA-002 | Reteste upload check-in Ederlon (mobile) | 🟡 manual |
| BH-QA-003 | Fix `nome_completo` perfil coach | ✅ |
| BH-QA-004 | Refeição livre E2E | ✅ |
| BH-QA-005 | Realtime coach | ✅ |
| BH-QA-006 | `GET /api/treinos` 404 | ✅ |

---

## Próximas prioridades sugeridas

1. **BH-QA-002** — reteste manual Ederlon + Christian Calhares (mobile check-in)  
2. **Fase 4.6** — piloto com 5 alunos (`docs/arquivo/2026-06-07-fase4-e-proximos-passos.md`)  
3. **Fase 4.5** — fechar backlog a11y restante após piloto  
4. **Import em lote** — quando retomar o epic  
5. ~~**Dívida:** `applyNutritionPatch.js`~~ — ✅ transacção por ficheiro + `schema_patches` (07/jun)

---

## Mobile (2026-06-07)

- Safe area inferior no portal aluno (`pb-student-main`, bottom nav condicional) — ✅ deployado
