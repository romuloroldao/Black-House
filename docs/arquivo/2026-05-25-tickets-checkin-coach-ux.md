# Tickets técnicos — UX Check-in Coach (Black House)

**Data:** 2026-05-25  
**Validação Q1:** aceite 2026-05-26 (`docs/arquivo/2026-05-26-qa-deploy-checkin-aluno.md`)  
**Epic:** Coach visualiza e responde respostas individuais do check-in semanal  
**Referência UX:** proposta de produto check-in coach (maio/2026)

---

## Sprint 1 — Quick Wins (Q1 implementado)

### BH-CHECKIN-001 ✅ Timeline + drawer na ficha do aluno
**Prioridade:** P0 · **Esforço:** M · **Impacto:** Alto

**Descrição:** Na ficha do aluno → aba Progresso, adicionar sub-abas **Check-ins | Análise**. Check-ins lista cronológica; clique abre sheet lateral com respostas completas por secção (Nutrição, Treino, Sono, Bem-estar).

**Arquivos:**
- `src/components/coach/StudentProgressCoachTabs.tsx` (novo)
- `src/components/coach/CoachCheckinTimeline.tsx` (novo)
- `src/components/coach/CoachCheckinDetailSheet.tsx` (novo)
- `src/lib/checkin-display.ts` (novo)
- `src/types/weekly-checkin.ts` (novo)
- `src/components/StudentDetails.tsx` (integração)

**Critérios de aceite:**
- [ ] Coach vê lista de check-ins ordenada (mais recente primeiro)
- [ ] Cada item mostra data, chips-resumo e preview do relato
- [ ] Drawer exibe relato em destaque + 4 tabs com todos os campos
- [ ] Navegação ◀ ▶ entre check-ins no drawer
- [ ] Default da sub-aba = Check-ins (triagem antes de gráficos)

**Deploy:** frontend `/var/www/blackhouse/dist` (build 2026-05-25)

---

### BH-CHECKIN-002 ✅ Resposta inline no drawer
**Prioridade:** P0 · **Esforço:** S · **Impacto:** Alto

**Descrição:** Footer do drawer com textarea, “Salvar resposta” (`feedbacks_alunos`) e “Abrir chat” (deep link `?tab=messages&aluno_id=`).

**Critérios de aceite:**
- [ ] POST/PATCH feedback com `coach_id` autenticado
- [ ] Erro visível se save falhar
- [ ] Chat abre conversa do aluno selecionado

**Dependência:** fix deep link MessageManager (já em produção)

---

### BH-CHECKIN-003 ✅ Delta vs semana anterior
**Prioridade:** P1 · **Esforço:** S · **Impacto:** Médio

**Descrição:** Em campos escalares e booleanos, mostrar “↑/↓/= vs sem. anterior”.

**Arquivos:** `src/lib/checkin-display.ts` (`compareCheckinField`, `deltaLabel`)

**Critérios de aceite:**
- [ ] Adesão, autoestima e booleans mostram delta quando há check-in anterior
- [ ] Campos enum/texto sem delta numérico não quebram UI

---

## Sprint 2 — Triagem global

### BH-CHECKIN-004 Inbox de check-ins no sidebar ✅ (parcial)
**Prioridade:** P0 · **Esforço:** L · **Impacto:** Alto · **Status:** implementado (sem contador/badge ainda)

**Arquivos:** `CoachCheckinInbox.tsx`, `Sidebar.tsx`, `AppLayout.tsx`

**Critérios de aceite:**
- [x] Lista agregada cross-aluno com filtros básicos
- [x] Clique abre drawer de detalhe (componente reutilizado)
- [ ] Contador no sidebar (ex.: “3 pendentes”) — pendente BH-005

---

### BH-CHECKIN-005 Estado “respondido” no backend
**Prioridade:** P1 · **Esforço:** M · **Impacto:** Alto

**Descrição:** Rastrear se coach respondeu cada check-in.

**Schema (migração):**
```sql
ALTER TABLE public.weekly_checkins
  ADD COLUMN IF NOT EXISTS coach_respondido_em timestamptz,
  ADD COLUMN IF NOT EXISTS coach_respondido_por uuid REFERENCES app_auth.users(id);
```
**Alternativa:** derivar de `feedbacks_alunos.updated_at` + `weekly_checkin_id` (FK nova).

**API:** `PATCH /api/weekly-checkins/:id/respondido`

---

### BH-CHECKIN-006 Filtros na inbox ✅
**Prioridade:** P1 · **Esforço:** M · **Status:** concluído (2026-05-25)

**Filtros:** pendentes, respondidos, com relato, adesão ≤ 2, estresse, período (7d/30d/todo).

**Polimento:**
- [x] Filtro **Respondidos**
- [x] Default **Pendentes de resposta** (alinhado ao badge)
- [x] Contadores no select (`Pendentes (11)`)
- [x] `src/lib/checkin-inbox-filters.ts`

---

## Sprint 3 — Inteligência operacional

### BH-CHECKIN-007 Highlights automáticos ✅
**Prioridade:** P2 · **Esforço:** M · **Status:** concluído (2026-05-25)

**Regras:** estresse + adesão ≤2 + relato ≥100 caracteres → badge **Prioridade**.

**Arquivos:** `src/lib/checkin-highlights.ts`, `CheckinPriorityBadge.tsx`, inbox + timeline + drawer.

**Critérios:**
- [x] Badge Prioridade na inbox e timeline (ordenados no topo)
- [x] Banner de triagem na inbox quando há prioritários na visão
- [x] Destaque no drawer com resumo dos critérios
- [x] Filtro **Prioridade** na inbox

---

### BH-CHECKIN-008 Gráfico clicável → check-in da semana ✅
**Prioridade:** P2 · **Esforço:** S · **Status:** concluído (2026-05-25)

**Descrição:** Clicar ponto/barra nos gráficos de `StudentProgressDashboard` (modo coach com `studentId`) abre `CoachCheckinDetailSheet` da semana, com navegação ◀▶ e resposta.

**Critérios:**
- [x] Gráficos Adesão/Autoestima, Hábitos e Sono clicáveis
- [x] Hint visual para o coach
- [x] Integrado na aba Análise da ficha do aluno

---

### BH-CHECKIN-009 Busca full-text em relatos ✅
**Prioridade:** P2 · **Esforço:** M · **Status:** concluído (2026-05-25)

**Backend:** `GET /api/weekly-checkins?q=` com `ILIKE` em `nao_cumpriu_porque` e nome do aluno; migração `pg_trgm` + índice GIN.

**Frontend:** campo na inbox (`checkin-relato-search.ts`); busca ≥2 chars com debounce na API; 1 char filtra localmente.

**Critérios:**
- [x] Busca por nome do aluno ou texto do relato
- [x] API `?q=` para coach/admin
- [x] Índice GIN (`server/migrations/20260527_checkin_relato_search.sql`)

---

### BH-CHECKIN-010 Notificação push/email “novo check-in” ✅
**Prioridade:** P0 (triagem) · **Esforço:** L · **Status:** concluído (2026-05-25)

**Descrição:** Quando o aluno envia `POST /api/checkins`, o coach recebe notificação in-app, push WebSocket e e-mail (se preferência `in_app_and_email`).

**Arquivos:**
- `server/services/notification.service.js` — `notifyNewWeeklyCheckin`
- `server/utils/coach-notification-email-templates.js` — template `new_weekly_checkin`
- `server/routes/api.js` — hook pós-criação
- `src/hooks/useCoachCheckinNotifications.ts` — toast + refresh badge
- `NotificationsPopover.tsx` — coach vê notificações
- `Sidebar.tsx` — badge atualiza em tempo real

**Critérios:**
- [x] In-app (`notificacoes` + link `check-ins`)
- [x] WebSocket `new_weekly_checkin`
- [x] E-mail transacional (respeita `coach_profiles.notification_channel`)
- [x] Toast no painel do coach
- [x] Badge da sidebar atualiza sem esperar 60s

---

## Sprint 4+ — Escala e IA

| Ticket | Título | Esforço |
|--------|--------|---------|
| BH-CHECKIN-010 | Notificação push/email “novo check-in” ✅ | L |
| BH-CHECKIN-011 | Resumo IA de tendências (4 semanas) | L |
| BH-CHECKIN-012 | Rascunho de resposta IA editável | L |
| BH-CHECKIN-013 | Comparação side-by-side duas semanas | M |
| BH-CHECKIN-014 | Export PDF do check-in | M |
| BH-CHECKIN-015 | Inbox por equipa (head coach) | L |

---

## Matriz impacto × esforço

| Quadrante | Tickets |
|-----------|---------|
| **Alto impacto / baixo esforço** | 001✅ 002✅ 003✅ 008 |
| **Alto impacto / alto esforço** | 004 005 010 |
| **Médio / médio** | 006 007 009 013 |
| **Futuro** | 011 012 014 015 |

---

## Dependências técnicas

| Área | Nota |
|------|------|
| API | `GET /api/weekly-checkins` já filtra por coach |
| Feedback | `feedbacks_alunos` via legacy `/rest/v1/` — migrar para rota semântica dedicada |
| Chat | Deep link `aluno_id` no MessageManager |
| Schema | Sem alteração para Q1; 005 requer migração |

---

## Test plan (Q1)

1. Login como coach → Alunos → abrir aluno com check-ins
2. Aba **Progresso** → sub-aba **Check-ins** (default)
3. Clicar item da timeline → drawer abre com relato + 4 secções
4. Navegar ◀ ▶ entre semanas
5. Escrever resposta → Salvar → verificar registo em `feedbacks_alunos`
6. **Abrir chat** → conversa do aluno pré-selecionada
7. Sub-aba **Análise** → gráficos existentes intactos
8. Mobile: sheet full-width, scroll e footer acessíveis
