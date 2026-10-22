# Onboarding contextual inteligente — jornada do aluno (2026-10-22)

Documento vivo desta iniciativa. Segue `docs/REGRAS-PARA-NAO-CONFUNDIR.md`: relatório em `docs/arquivo/`, código + `docs/ARQUITETURA-ATUAL.md` mandam.

## 1. Mapa da jornada (inventário)

Fonte: código em `main` (`/tmp/visux` / VPS `/root`), rotas em `App.tsx` + `StudentPortal.tsx`.

| ID | Funcionalidade | Entrada | Objetivo do aluno | Ações principais | Uso observado (30d) | Recorrência | Complexidade | Valor | Onboarding? | Prioridade |
|----|----------------|---------|-------------------|------------------|---------------------|-------------|--------------|-------|-------------|------------|
| TP-HOJE | Hoje / Coleman | `?tab=hoje` · bottom nav | Ver o dia, falar com Coleman, atalhos | Composer, chips, Mais do dia, cards de ação | 5 alunos com `agent_sessions`; 148 `agent_messages` | Diária (entrada) | Média (agent-first pouco óbvio) | Alto (hub) | Sim — descoberta do hub | **P1** |
| TP-DIETA | Dieta | `?tab=diet` · bottom | Seguir plano, marcar refeições | Plano A/B, conclusão, foto/substituição | 211 conclusões · **12** alunos | Diária (poucos) | Média–alta | Alto | Sim — marcar refeição | **P2** |
| TP-TREINO | Treinos / sessão | `?tab=workouts` · bottom | Executar ficha, registar séries | Iniciar sessão, cargas, descanso | 193 sessões · **24** alunos | Semanal–diária | Alta (série a série) | Alto | Sim — iniciar sessão | **P1** |
| TP-COACH | Coach (chat/avisos) | `?tab=coach` · bottom | Falar com coach, ler avisos | Chat, avisos | 9 mensagens | Sob demanda | Baixa | Médio | Depois | P3 |
| TP-CHECKIN | Check-in semanal | `?tab=checkin` · sidebar/Mais | Enviar peso/fotos/relato | Blocos, fotos, peso, enviar | **163** check-ins · **50**/68 alunos | Semanal | **Alta** (multi-bloco + upload) | Crítico p/ coach | Sim — fotos+envio | **P0** |
| TP-PROGRESSO | Evolução / fotos | `?tab=progress` | Ver evolução | Fotos, métricas, comparar | 445 `fotos_alunos` (ligado a check-in) | Semanal | Média | Alto | Depois | P3 |
| TP-VIDEOS | Vídeos | `?tab=videos` | Assistir conteúdos | Lista/player | Sem contagem de play no DB | Sob demanda | Baixa | Médio | Não agora | P4 |
| TP-EDU | Biblioteca educativa | `?tab=education` + `/guia/:id` | Ler materiais | Abrir guia | — | Sob demanda | Baixa | Médio | Não agora | P4 |
| TP-RELAT | Relatórios | `?tab=reports` | Ver resumos | Visualizar | — | Baixa | Baixa | Médio | Não agora | P4 |
| TP-FIN | Financeiro | `?tab=financial` | Ver situação | Visualizar | — | Baixa | Baixa | Baixo (aluno) | Não | — |
| TP-PERFIL | Perfil | `?tab=profile` | Completar dados, prefs | Editar, notifs | `student_profile_state` / hard gate | Sob demanda | Média | Alto (gate) | Wizard já existe | P3 |
| TP-OVERVIEW | Tour geral (legado) | Portal (dialog) | Visão da plataforma | 4 passos modal | Só `localStorage` `bh-student-onboarding-v2` | 1× | Baixa | Médio | Migrar p/ prefs servidor | P1 (não bloquear) |

### Navegação

- **Mobile:** `StudentBottomNav` — Hoje · Dieta · Treino · Coach (`md:hidden`).
- **Desktop/Mais:** `StudentSidebar` — progress, videos, education, reports, financial, profile, check-in.
- **Atalhos:** Menu header, `AgentReturnFab` → Hoje, drawer “explore”.

### Gates

- Pagamento overdue → `/portal-aluno/blocked`.
- Acesso operacional → `/access-blocked`.
- Perfil incompleto + hard gate → bloqueia envio de check-in (`requireCompleteProfile`).
- Wizard de perfil: 1× por sessão (`bh-profile-wizard-shown`).

### Limitações do inventário

- Não há analytics de pageview por aba (só `trackAgentEvent` no Agent Home).
- Contagens DB = ações persistidas, não “visitas”.
- `dieta_substituicoes_*` não existe na VPS com o nome esperado; não contado.

---

## 2. Diagnóstico de utilização

**Base produção** (`blackhouse_db`, leitura 2026-10-22, 68 alunos):

| Métrica | Valor |
|---------|-------|
| Check-ins 30d / alunos distintos | 163 / 50 |
| Sessões de treino 30d / alunos | 193 / 24 |
| Conclusões de refeição 30d / alunos | 211 / 12 |
| Fotos 30d | 445 |
| Sessões agent / alunos | 5 / 5 |
| Mensagens (chat) 30d | 9 |

**Interpretação (hipótese + evidência):**

- Check-in é o hábito mais **amplo** (≈74% dos alunos). Complexidade alta + incidentes recentes de hang → maior ROI de orientação.
- Treino tem volume alto mas concentrado (24 alunos). Quem usa, usa muito — onboarding na 1ª sessão reduz abandono.
- Dieta: poucas pessoas marcam refeições; possível problema de descoberta (hipótese).
- Coleman/Hoje: adoção agent baixa vs papel de hub — descoberta insuficiente (hipótese; eventos `agent_*` só no cliente, sem agregação server).

**Instrumentação existente:** `src/lib/agent-analytics.ts` (CustomEvent, sem vendor). Sem `trackStudentEvent` em produção.

---

## 3. Matriz de priorização

Escala 1–5. Pesos: frequência 0,15 · relevância 0,25 · complexidade 0,20 · descoberta 0,20 · risco abandono 0,10 · autonomia 0,10.

| ID | Freq | Rel | Cx | Desc | Risco | Aut | Score | Uso | Cx evidência | Hipótese | Rec. |
|----|------|-----|----|------|-------|-----|-------|-----|--------------|----------|------|
| TP-CHECKIN | 5 | 5 | 5 | 4 | 5 | 5 | **4,80** | Observado | Multi-bloco + upload | Hang Android | Implementar P0 |
| TP-HOJE | 3 | 5 | 3 | 5 | 3 | 4 | **3,95** | Parcial (agent DB) | Agent-first | Poucos usam Coleman | Implementar P1 |
| TP-TREINO | 4 | 5 | 5 | 4 | 4 | 5 | **4,55** | Observado | Sessão série a série | 1ª sessão confusa | Implementar P1 |
| TP-DIETA | 3 | 5 | 4 | 5 | 3 | 4 | **4,15** | Observado (estreito) | Plano A/B + marcar | Poucos concluem | Implementar P2 |
| TP-COACH | 1 | 3 | 2 | 2 | 1 | 2 | 2,05 | Observado baixo | Chat simples | — | Depois |
| TP-OVERVIEW | 2 | 3 | 2 | 3 | 2 | 2 | 2,40 | Só localStorage | Modal genérico | Interrompe | Migrar, não obrigar |

Score = Σ (nota × peso).

---

## 4. Estratégia de experiência (P0–P2)

Princípios: contextual, não obrigatório, “Não ver de novo” por tutorial, reabrir via ajuda, `prefers-reduced-motion`.

### Estados

| Estado | Auto-exibir? | Reabrir ajuda? | Versão nova (`forceReshow`)? |
|--------|--------------|----------------|------------------------------|
| `never` | Sim (1ª visita elegível) | — | — |
| `in_progress` | Retoma / recomeça no step 0 se stale | Sim | — |
| `completed` | Não | Sim | Só se flag no registry |
| `skipped` | Não (mesma versão) | Sim | Só se flag |
| `dismissed_permanently` | Nunca | Sim | **Não** (respeitar preferência) |

Skip ≠ dismiss: skip não é “nunca mais”; dismiss é por tutorial.

### Conteúdos prioritários

#### `checkin-weekly` v1 (P0)

- Objetivo: saber anexar fotos (frente/costas), peso e enviar sem ficar preso.
- Elegível: `tab=checkin`, perfil sem hard gate bloqueando UI, não em submit.
- Etapas (3): (1) fotos + peso · (2) blocos Próximo · (3) Enviar e progresso.
- Targets: `[data-onboarding="checkin-photos"]`, `checkin-steps`, `checkin-submit`.
- Formato: painel compacto inferior + highlight do alvo.

#### `hoje-coleman` v1 (P1)

- Objetivo: usar Hoje como hub e o composer do Coleman.
- Targets: composer / chips / Mais do dia.
- 2–3 etapas. Não competir com wizard de perfil nem tour overview no mesmo frame.

#### `treino-sessao` v1 (P1)

- Objetivo: iniciar sessão e registar 1ª série.
- Targets: botão iniciar / log de série.
- Evitar durante sessão `in_progress` crítica (só se ainda não iniciou ou no primeiro ecrã da lista).

#### `dieta-refeicao` v1 (P2)

- Objetivo: marcar refeição e achar Plano A/B.
- Targets: toggle plano / botão concluir.

#### `portal-overview` v1

- Migração do `StudentOnboardingDialog`; deixa de ser único gate localStorage; passa a prefs servidor + “Não ver de novo”.

---

## 5. Arquitetura reutilizável

```
src/lib/onboarding/
  types.ts          — estados, Step, Definition
  registry.ts       — catálogo estável por id
  analytics.ts      — eventos onboarding_*
  prefs-cache.ts    — cache local por aluno+id
hooks/useFeatureOnboarding.ts
components/student/onboarding/FeatureOnboardingPanel.tsx
server/migrations/20261022_student_feature_onboarding.sql
server/services/feature-onboarding.service.js
GET/PUT /api/alunos/me/onboarding-preferences
```

Persistência **canónica:** Postgres. Cache local só para resiliência offline / falha de API (nunca apaga dismiss do servidor).

---

## 6. Persistência (“Não ver de novo”)

Tabela `student_feature_onboarding`:

- `(aluno_id, onboarding_id)` UNIQUE
- `version`, `state`, `dismiss_permanently`, `current_step`, `updated_at`, `completed_at`

Autorização: só `req.aluno.id` via `resolveAlunoOrFail`.

---

## 7. Métricas

Eventos cliente (CustomEvent) + persistência servidor:

| Cliente | Servidor (`student_onboarding_events.event_name`) |
|---------|-----------------------------------------------------|
| `onboarding_eligible` | `eligible` (POST) |
| `onboarding_viewed` | `viewed` (POST) |
| `onboarding_step_viewed` | `step_viewed` (POST) |
| `onboarding_completed` | `completed` (via PUT prefs) |
| `onboarding_skipped` | `skipped` (via PUT prefs) |
| `onboarding_dismissed_permanently` | `dismissed_permanently` (via PUT prefs) |
| `onboarding_reopened` | `reopened` (POST) |

Endpoint: `POST /api/alunos/me/onboarding-events` — só metadados (`onboarding_id`, `version`, `step_id`).

Indicadores: início, conclusão, abandono por step, dismiss, reopen. Conclusão ≠ aprendizado.

---

## 8. Testes

- Unit (node:test): `src/lib/onboarding/policy.test.mjs` — 6 cenários (pass).
- Build + `verify:api-contract` + guarda no-Supabase — OK.
- E2E: helper `dismissOnboardingIfVisible` atualizado para «Pular»; cenários com credenciais dependem de `E2E_STUDENT_*`.

---

## 9. Limitações

- Sem pageviews por aba.
- Agent analytics só no browser.
- Substituições de dieta sem tabela homónima na VPS no momento da auditoria.
- Contagens DB = ações persistidas, não visitas de ecrã.

## 10. Implementação entregue (MVP)

| Peça | Onde |
|------|------|
| Migração | `server/migrations/20261022_student_feature_onboarding.sql` + `schema_adaptado_postgres.sql` |
| API | `GET/PUT /api/alunos/me/onboarding-preferences` |
| Registry / política / analytics | `src/lib/onboarding/*` |
| Hook + painel | `useFeatureOnboarding`, `FeatureOnboardingPanel` |
| Tutoriais | `portal-overview`, `checkin-weekly`, `hoje-coleman`, `treino-sessao`, `dieta-refeicao`, `progresso-evolucao` |
| Reabrir | botão «Como usar» nas telas prioritárias |
| Funil coach | `GET /api/coach/me/onboarding-funnel` + card no Dashboard |

## 11. Próximos passos

1. Agregar eventos onboarding no servidor (opcional).
2. E2E dedicado com aluno de teste (dismiss + persistência cross-device).
3. Validar com coach se check-in P0 reduz suporte WhatsApp.
