# Plano de ação — Melhoria da experiência do aluno

**Branch:** `melhoria-aluno`  
**Data:** 2026-05-25  
**Objetivo:** Transformar o portal do aluno em experiência moderna, clara, mobile first e premium, alinhada ao diagnóstico de UX/UI.

**Referência de produto:** `/portal-aluno` (ex.: `?tab=diet`, `?tab=dashboard`)  
**Arquitetura:** React (Vite) + API Node/PostgreSQL — ver `docs/ARQUITETURA-ATUAL.md`.

---

## Visão geral

| Fase | Nome | Duração estimada | Resultado para o aluno |
|------|------|------------------|------------------------|
| 0 | Fundação e confiança | 1–2 semanas | Dados reais, menos erros, menu mais claro |
| 1 | “Hoje” + Dieta v2 | 3–4 semanas | Sabe o que fazer hoje; dieta legível no telemóvel |
| 2 | Treino em modo sessão | 3–4 semanas | Treinar na academia com fluxo dedicado |
| 3 | Engajamento e check-in | 2–3 semanas | Streak, progresso, check-in por blocos — **concluída** |
| 4 | Polish premium | 2 semanas | Motion, onboarding, a11y, testes com alunos — **em curso** |

**Total estimado:** 11–15 semanas (pode sobrepor QA e deploy incremental por PR).

---

## Princípios (não negociáveis)

1. **Nunca exibir métricas inventadas** — remover mocks (ex.: “85% dieta”, “5 treinos/semana” hardcoded em `StudentDashboardView`).
2. **Mobile first** — bottom nav 4 itens + “Mais”; alvos tácteis ≥ 44px.
3. **“Hoje” como casa** — treino + dieta + pendências num único ecrã.
4. **Coach unificado** — um hub (chat + avisos), não dois menus.
5. **PRs pequenos** — uma melhoria reviewable por PR; deploy incremental.

---

## Fase 0 — Fundação e confiança

**Meta:** Corrigir o que quebra confiança e navegação antes do redesign visual grande.

### 0.1 Dashboard com dados reais

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 0.1.1 | Remover percentagens e números fixos | `src/components/student/StudentDashboardView.tsx` | Só valores vindos da API ou “—” / skeleton |
| 0.1.2 | Mostrar treino activo, dieta activa, eventos reais | Idem + APIs existentes | Cards refletem `getMe`, `dietas`, `alunos-treinos`, `agenda-eventos` |
| 0.1.3 | Bloco de pendências (check-in, mensagens, retorno) | Novo componente ou secção no dashboard | Lista itens accionáveis com link para tab/rota |

### 0.2 Navegação simplificada (preparação)

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 0.2.1 | Agrupar itens do menu: primário vs “Mais” | `StudentSidebar.tsx`, `StudentPortal.tsx` | ≤4 itens principais visíveis no mobile |
| 0.2.2 | Unificar Chat + Mensagens → **Coach** | Sidebar + rotas `tab=coach` (alias redirects) | Um único ponto para comunicação |
| 0.2.3 | Mover Financeiro, Relatórios, Vídeos, Perfil para “Mais” | Sheet/drawer secundário | Menu principal focado em diário |

### 0.3 Retorno e ciclo Black House

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 0.3.1 | Exibir `data_retorno` da dieta/treino activo | Dashboard / Dieta / Hoje | Countdown “Retorno em X dias” |
| 0.3.2 | Nome legível do plano (ex.: “Retorno 19 Abr”) | `StudentDietView`, hero cards | Usa `dieta.nome`, não só ID técnico |

### 0.4 Estabilidade API (aluno)

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 0.4.1 | Garantir `GET /api/mensagens` estável | `server/routes/api.js` (já corrigido `get_or_create_conversa`) | 200 para aluno vinculado; conversa criada se necessário |
| 0.4.2 | Check-in: validação frontend + campos opcionais claros | `StudentWeeklyCheckin.tsx` | Toast com campos em falta; glicemia/observações opcionais |
| 0.4.3 | Deploy frontend alinhado (`build-e-deploy.sh`) | Ops | Bundle actual em produção |

### Entregáveis Fase 0

- [x] PR `feat(aluno): dashboard dados reais e pendências`
- [x] PR `feat(aluno): navegação agrupada e hub coach`
- [x] PR `feat(aluno): countdown retorno e copy premium em empty states`

---

## Fase 1 — “Hoje” + Dieta v2

**Meta:** Resposta em 3 segundos: o que treinar, o que comer, o que está pendente.

### 1.1 Novo ecrã **Hoje** (substitui dashboard como default)

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 1.1.1 | Criar `StudentTodayView.tsx` | `src/components/student/` | Hero + treino + dieta + pendências |
| 1.1.2 | Default tab `hoje` ou `dashboard` → conteúdo Hoje | `StudentPortal.tsx`, rotas | Login aluno cai no Hoje |
| 1.1.3 | Componentes: `TodayHeroCard`, `PendingTasksList`, `ReturnCountdown` | `src/components/student/today/` | Reutilizáveis, testados em mobile |

### 1.2 API agregada (recomendado)

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 1.2.1 | `GET /api/alunos/me/hoje` | `server/routes/api.js` | JSON: treino, dieta resumo, pendências, retorno, streak placeholder |
| 1.2.2 | Contrato em `api-contract.ts` + `apiClient.getToday()` | `src/contracts/`, `src/lib/api-client.ts` | Uma chamada no mount do Hoje |

### 1.3 Dieta — timeline e checklist

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 1.3.1 | Timeline vertical de refeições | `StudentDietView.tsx` ou `StudentDietDayView.tsx` | Scroll curto; refeição actual destacada |
| 1.3.2 | Tabs Plano A / Plano B (quando `refeicao.plano` ou campo equivalente) | Dieta | Alternância sem perder contexto |
| 1.3.3 | Toggle “refeição concluída” (localStorage → depois API) | Por refeição | Barra “3/8 refeições”; persistência mínima V1 |
| 1.3.4 | Macro rings (dia + opcional por refeição) | Componente `MacroRing` | SVG leve; sem chart pesado |
| 1.3.5 | Drill-down refeição (alimentos grandes, substitutos) | Rota ou drawer `refeicao/:id` | Legível na cozinha |

### 1.4 Mobile bottom navigation

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 1.4.1 | `StudentBottomNav.tsx` — Hoje, Dieta, Treino, Coach | Novo + `StudentPortal` layout | Fixo no fundo; safe-area |
| 1.4.2 | Sidebar só desktop (≥ md) | `StudentSidebar.tsx` | Paridade de tabs com bottom nav |

### Entregáveis Fase 1

- [x] PR `feat(aluno): endpoint /api/alunos/me/hoje`
- [x] PR `feat(aluno): ecrã Hoje e bottom nav`
- [x] PR `feat(aluno): dieta timeline, planos A/B e checklist`

---

## Fase 2 — Treino em modo sessão

**Meta:** Experiência de execução na academia, não só leitura de PDF.

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 2.1 | “Treino de hoje” no Hoje + CTA **Iniciar** | `StudentTodayView`, `StudentWorkoutsView` | Um treino principal destacado |
| 2.2 | `StudentWorkoutSessionView.tsx` — exercício a exercício | Nova rota/tab ou fullscreen | N/N exercícios, séries, descanso |
| 2.3 | Timer de descanso (opcional configurável) | Sessão | Start/pause; não bloqueia sem JS |
| 2.4 | Marcar série/concluído (estado local V1) | Sessão | Persistência `localStorage` ou endpoint futuro |
| 2.5 | Tela fim de sessão (resumo + CTA voltar) | Sessão | Feedback positivo (copy + ícone) |
| 2.6 | Manter modo lista + export PDF | `StudentWorkoutsView` | Coaches/alunos avançados |

### Entregáveis Fase 2 (MVP)

- [x] Treino de hoje + Iniciar sessão em `StudentWorkoutsView`
- [x] `StudentWorkoutSessionView` fullscreen com timer e progresso local
- [x] CTA Iniciar também no ecrã Hoje (link direto para workouts + sessão)

### Entregáveis Fase 2

- [x] PR `feat(aluno): modo sessão treino MVP`
- [x] PR `feat(aluno): treino de hoje e melhorias lista`

---

## Fase 3 — Engajamento e check-in

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 3.1 | Check-in em 4 blocos com progress bar | `StudentWeeklyCheckin.tsx` | Nutrição, Treino, Sono, Bem-estar |
| 3.2 | Streak de check-ins (semanas consecutivas) | Backend query + UI no Hoje | Dado real a partir de `weekly_checkins` |
| 3.3 | Progresso unificado | `StudentProgressView` / dashboard progresso | Peso, check-ins, link para relatórios |
| 3.4 | Centro de notificações categorizado | `NotificationsPopover` ou página | Coach / Sistema / Retorno |
| 3.5 | Conquistas discretas (badges estáticos V1) | Hoje ou Progresso | Ex.: “4 check-ins seguidos” |

### Entregáveis Fase 3

- [x] PR `feat(aluno): check-in por secções`
- [x] PR `feat(aluno): streak e progresso visual`
- [x] Notificações categorizadas (Coach / Sistema / Retorno) — Fase 4.4

---

## Fase 4 — Polish premium

| # | Tarefa | Ficheiros / área | Critério de aceite |
|---|--------|------------------|-------------------|
| 4.1 | Tokens BH Student (tipografia, spacing, cores semânticas macros) | `index.css`, `tailwind.config` | Documentado em comentário ou `docs/` |
| 4.2 | Motion system (Framer Motion já no projeto) | Transições Hoje → Sessão, toggles refeição | `prefers-reduced-motion` respeitado |
| 4.3 | Onboarding 3 passos (primeiro login) | Novo fluxo + flag local/perfil | Skippable |
| 4.4 | Empty/loading states padronizados | `PremiumEmptyState`, skeletons | Todas as views aluno |
| 4.5 | Auditoria a11y (contraste, focus, labels) | Portal aluno | Sem regressões WCAG AA críticas |
| 4.6 | Teste com 5 alunos + coach (roteiro E2E manual) | `docs/arquivo/` checklist | Feedback registado |

### Entregáveis Fase 4

- [x] PR `chore(aluno): design tokens e motion` (CSS tokens + `student-tab-enter`)
- [x] PR `feat(aluno): onboarding e empty states`
- [x] Checklist teste: `docs/arquivo/2026-05-25-checklist-teste-aluno.md`
- [ ] Auditoria a11y completa (4.5) com 5 alunos reais (4.6)

---

## Design system (resumo para implementação)

| Token / componente | Uso |
|--------------------|-----|
| `TodayHeroCard` | Topo do Hoje |
| `ReturnCountdown` | Dias até retorno |
| `MealTimelineItem` + `MealCheckToggle` | Dieta dia |
| `MacroRing` | Macros dia/refeição |
| `WorkoutSessionPlayer` | Modo sessão |
| `CoachHubView` | Chat + avisos |
| `StudentBottomNav` | Mobile nav |
| `PendingTasksList` | Pendências accionáveis |
| `PremiumEmptyState` | Sem dieta/treino |

**Cores:** manter ouro `primary` para CTAs e progresso; superfícies `#141416`; macros com cores semânticas (P/C/G).

---

## Ordem recomendada de PRs (backlog)

1. `fix(aluno): dashboard sem métricas mock`  
2. `feat(aluno): pendências e countdown retorno`  
3. `feat(aluno): hub coach e menu agrupado`  
4. `feat(api): GET /api/alunos/me/hoje`  
5. `feat(aluno): StudentTodayView + bottom nav`  
6. `feat(aluno): dieta timeline + checklist`  
7. `feat(aluno): workout session MVP`  
8. `feat(aluno): check-in por blocos + streak`  
9. `polish(aluno): motion, onboarding, a11y`  

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Branch `lancamento` com muitas alterações não commitadas | Trabalhar só em `melhoria-aluno`; merge de `lancamento` planeado à parte |
| Scope creep no modo sessão | MVP sem histórico de cargas na V1 |
| Performance em listas longas de alimentos | Virtualização na Fase 1.3 se > 50 itens |
| Duplicar PM2/systemd em deploy API | Um supervisor; documentar em ops |

---

## Métricas de sucesso (pós Fase 1–2)

- Tempo até primeira acção (abrir treino ou refeição) **< 10 s** após login.  
- Taxa de conclusão de check-in **+20%** vs baseline (medir em 4 semanas).  
- Zero relatórios de “número errado no dashboard”.  
- NPS interno ou feedback qualitativo de 5 alunos: “sei o que fazer hoje”.

---

## Como trabalhar nesta branch

```bash
git checkout melhoria-aluno
# desenvolver por PR pequeno → merge em melhoria-aluno
# quando estável: PR melhoria-aluno → lancamento (ou main)
```

**Não usar** `.worktrees/checkpoint/` como cópia de trabalho (regra do projeto).

---

## Próximo passo imediato

1. ~~**QA manual**~~ — **Concluído** (2026-05-26). Ver `docs/arquivo/2026-05-26-qa-deploy-checkin-aluno.md`.  
2. ~~**Merge** `melhoria-aluno` → `lancamento`~~ — **Feito** (PR #4).  
3. **Backlog activo:** import P1 (`docs/arquivo/2026-05-25-especificacao-importacao-contextual-p0.md` §9); check-in Sprint 4+ (IA/PDF); polish pós-MVP (histórico cargas, macros só plano activo).
