# PRD — Black House (produto completo)

| Campo | Valor |
|-------|--------|
| **Produto** | Black House |
| **Documento** | Product Requirements Document unificado |
| **Data** | 2026-08-18 |
| **Natureza** | As-built + requisitos vigentes. Não é um pitch de produto futuro. |
| **Fonte de verdade** | Código na raiz (`src/`, `server/`) + [`docs/ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) |
| **Substitui como PRD vivo** | [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md) e [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md) — esses ficam histórico |
| **Fora de âmbito** | Pasta `.worktrees/checkpoint/`; docs de legado pré-PostgreSQL/JWT |

---

## 0. Como ler este documento

Há dois erros comuns ao descrever a Black House:

1. Tratar o painel do coach como se já fosse “agentic”. **Não é.** O coach opera um back-office clássico (listas, fichas, inbox, financeiro).
2. Tratar o portal do aluno como um conjunto de tabs iguais às de Julho. **Já não é.** A home é o Coleman (agente de nutrição e performance); dieta, treino e check-in continuam a existir como UIs especializadas.

Este PRD descreve **os dois produtos que convivem na mesma plataforma**, o contrato entre eles, a arquitectura que os sustenta e a experiência de cada persona.

Onde o código e a narrativa divergem, o código ganha — e a divergência fica listada em **§16 Lacunas**.

---

## 1. Visão do produto

### 1.1 O que a Black House é

Plataforma B2B2C de acompanhamento de performance e nutrição:

- o **coach** vende e opera o acompanhamento (alunos, dieta, treino, check-in, cobrança, comunicação);
- o **aluno** executa o plano no telemóvel, com um agente (Coleman) como interface principal de intenção e ecrãs especializados para o que o chat não faz melhor (sessão de treino, editor visual de fotos, formulário de check-in).

Não é um app de treino genérico, nem um chatbot de dieta, nem um ERP financeiro. É o sistema operativo da relação comercial **coach → aluno**.

### 1.2 Problema

Coaches de performance/nutrição gerem alunos em ferramentas fragmentadas (WhatsApp, PDFs, planilhas, gateways). Consequências:

| Lado | Fricção |
|------|---------|
| Coach | Tempo a responder check-ins, a actualizar dietas/treinos, a cobrar e a saber quem aderiu de facto |
| Aluno | Perde o “o que faço agora”; o plano vive em PDF; substituições e dúvidas voltam ao WhatsApp |
| Negócio | Acesso e pagamento desligados do produto; inadimplência sem bloqueio claro; execução diária invisível |

### 1.3 Hipótese de produto (vigente)

> Se o aluno executar o plano com menos navegação e mais orientação contextual (Coleman + dados reais), a aderência sobe e o coach passa a ver execução — não só o check-in semanal.

Hipótese secundária (parcialmente verdadeira hoje):

> O método do coach pode ser uma camada operacional (`coach_rules`) que o agente usa com autonomia limitada. A API existe; a UI de edição no painel coach é mínima.

Hipótese ainda **não** testada em produto:

> Um Coach Agent com HITL reduz o tempo de resposta a check-ins e prioriza a carteira. Isto é Phase 7 — não entregue.

### 1.4 Proposta de valor

| Stakeholder | Valor prometido | O que o produto realmente entrega hoje |
|-------------|-----------------|----------------------------------------|
| **Coach** | Operação centralizada da carteira | Ficha, dietas A/B, treinos + agenda, inbox de check-ins com IA de rascunho, chat, avisos, Asaas, acesso operacional |
| **Aluno** | Saber o que fazer hoje e conseguir fazê-lo | Coleman na home; dieta com substituições persistidas; sessão de treino com séries no servidor; check-in semanal; fotos/comparativo; pagamento |
| **Negócio** | Relação comercial com controlo de acesso | Dois eixos independentes: financeiro (Asaas) e operacional (coach) |

### 1.5 Princípios

1. **Coach é o centro comercial.** O aluno não existe de forma autónoma sem vínculo (excepto signup com `coach_id`).
2. **Determinístico primeiro.** Plano, horário, conclusões, permissões e evolução de carga vêm do domínio; LLM interpreta e comunica. Evolução de treino **não** passa por IA (`treino-evolucao.engine.js`).
3. **Intenção + UI especializada.** Conversação é a interface de intenção; não substitui sessão guiada, comparador de fotos nem editor de dieta.
4. **Tools, não SQL.** O agente nunca acede à BD directamente; tools com schema, política e audit.
5. **Dois eixos de bloqueio independentes.** Financeiro ≠ operacional.
6. **Mobile-first no aluno.** Bottom nav + sheets; overlay lock quando um sheet está aberto.
7. **pt-BR** como idioma de produto.
8. **Stack canónica.** React/Vite + Express + PostgreSQL + JWT. Sem Supabase em runtime.
9. **Autonomia explícita.** Níveis 0–4; alterar dieta/treino/financeiro é nível 4 (proibido ao agente).

### 1.6 Tensão estrutural (não esconder)

A Black House é **dois IAs de produto no mesmo código**:

```text
COACH          back-office de operação          desktop-first, sidebar, ?tab=
ALUNO          OS de execução diária            mobile-first, Coleman, ?tab=hoje
               ↑
         mesmo PostgreSQL, mesmo JWT, mesmo vínculo comercial
```

Isto não é um defeito por si. É uma escolha. O risco é optimizar um lado e fingir que o outro acompanhou: o aluno já tem agente; o coach ainda responde check-ins à mão (com rascunho IA). Quem priorizar “AI-first em tudo” sem Phase 7 está a descrever um produto que não existe.

---

## 2. Personas e papéis

| Papel | Quem é | Superfície | Notas honestas |
|-------|--------|------------|----------------|
| **Coach** | Operador comercial e clínico | `/` + `/financeiro/*` + ficha `/alunos/:id` | Persona primária de receita |
| **Aluno** | Executor do plano | `/portal-aluno/*` | Persona primária de uso diário |
| **Admin** | Super-utilizador | Mesmas rotas do coach + bypass RBAC | Cross-coach: vincular, papéis, Asaas/Twilio por coach |
| **Assistente** (`assistant`) | Membro de equipa | Teoricamente UI de coach | API de agenda/check-ins/métricas existe; `ProtectedRoute` **não** inclui `assistant` nas rotas `/`. UX dedicada limitada. Tratar como capacidade incompleta, não como persona suportada. |
| **Viewer** | Equipa, só leitura | Configurações → equipa | Mesma ressalva: convite existe; portal próprio não. |

Papéis em `UserRolesManager`: `coach`, `aluno`, `assistant`, `admin`.

---

## 3. Jobs-to-be-done

| Persona | Quando… | Quero… | Para… |
|---------|---------|--------|-------|
| Coach | um aluno entra | ficha + dieta + treino + cobrança num sítio | onboarding sem WhatsApp |
| Coach | chega o check-in | responder com contexto (anterior, fotos, tendências) | não reler a ficha inteira |
| Coach | o aluno atrasa pagamento | bloquear o portal sem apagar o vínculo | pressionar cobrança sem perder histórico |
| Coach | preciso suspender alguém | bloqueio operacional independente do Asaas | casos clínicos/disciplinares |
| Aluno | abro a app de manhã | saber o que fazer agora | não caçar tabs |
| Aluno | a dieta tem opções | trocar alimentos sem perguntar | autonomia no dia a dia |
| Aluno | como fora do plano | fotografar e perceber o impacto | decisão, não culpa |
| Aluno | treino | ser conduzido série a série, com carga | executar, não só “ver a lista” |
| Aluno | quero ver progresso | comparar fotos e peso Antes/Depois | percepção de evolução |
| Aluno | é dia de check-in | enviar o relatório em 5 passos | fechar a semana |

---

## 4. Arquitectura

### 4.1 Camadas

| Camada | Tecnologia | Entrada |
|--------|------------|---------|
| Frontend | React 18 + Vite 5 + TypeScript + React Router + TanStack Query + shadcn/Radix | Raiz: `package.json`, `src/` |
| Backend | Node.js + Express + Socket.io | `server/index.js` |
| BD | PostgreSQL | `schema_adaptado_postgres.sql` via `npm run db:migrate` / `server/runMigrations.js` |
| Auth | JWT + `app_auth.users` (funções SQL no schema) | `/auth/*` |
| Contrato HTTP | Paths semânticos `/api/*` | `src/contracts/api-contract.ts` ↔ `server/routes` |
| Realtime | Socket.io, path `/socket.io`, JWT no handshake | `server/services/websocket.service.js` |
| Jobs | `node-cron` no mesmo processo | `server/jobs/` |
| Email | Fila `email_queue` + Postfix → KingHost smtpkl | `server/jobs/email-queue.job.js` |
| Pagamentos | Asaas (por coach) | `server/services/asaas.service.js` |
| IA texto | Groq / OpenAI / Gemini com fallback | `server/services/ai/` |
| IA visão | Gemini Vision (refeição) | `meal-photo-ai.service.js` |
| Agente aluno | Orquestrador próprio + tools Zod | `server/services/agent/` |

**Não usar em runtime:** Supabase Auth, PostgREST, `anon` / `service_role`. Kill switch em `src/lib/supabase.ts`.

### 4.2 Variáveis de ambiente

| Ficheiro | Conteúdo |
|----------|----------|
| `.env` (raiz) | Só `VITE_*` — `VITE_API_URL`, opcional `VITE_API_BASE_URL`, `VITE_AGENT_DAILY_ENABLED` |
| `server/.env` | `JWT_SECRET`, `DB_*`, `PORT`, `API_URL`, chaves IA, Asaas, SMTP |

O servidor carrega primeiro `.env` da raiz, depois `server/.env` (sobrescreve).

### 4.3 Diagrama lógico

```text
Browser (Vite/React)
  ├─ apiClient  ──►  Express  ──►  PostgreSQL
  │     ▲                 │
  │     │                 ├─ domain services (hoje, dieta, treino, check-in, asaas, …)
  │     │                 ├─ agent orchestrator ── tool registry ── policy ── audit
  │     │                 └─ jobs (reminders, sync, email queue, adherence)
  └─ socket.io client ──►  mesmo processo HTTP, JWT no handshake

Nginx + PM2 na VPS. Frontend estático + API no mesmo domínio lógico
(api.blackhouse.app.br / app).
```

### 4.4 Auth, bootstrap e RBAC

Fluxo de arranque (histórico de deadlocks documentado; invariante actual):

1. `AuthProvider` inicializa (`authInitialized`).
2. `BootstrapGuard` não decide rotas antes disso.
3. `ProtectedRoute` espera `authInitialized`; timeout de 12s evita lock eterno.
4. Papel decide superfície: coach/admin → `/`; aluno → `/portal-aluno`.
5. Aluno: `checkPayment` redirecciona para `/portal-aluno/blocked`; acesso operacional para `/portal-aluno/access-blocked`.

Rotas públicas: `/auth` (login, signup, confirmação de email, forgot/reset).

Signup do aluno: nome, email, CPF, peso, altura, senha; `coach_id` opcional na query (provisiona ficha).

### 4.5 Contrato HTTP

O cliente **só** chama pathnames em `API_CONTRACT` / `CONTRACT_PATTERNS`. `npm run verify:api-contract` corre no `prebuild`. Não inventar rotas fantasma.

Endpoints estruturantes do aluno:

| Endpoint | Função |
|----------|--------|
| `GET /api/alunos/me/hoje` | Contexto do dia (plano, pendências, streak, unread) |
| `GET /api/alunos/me/proxima-acao` | Próxima acção determinística |
| `GET/POST /api/alunos/me/refeicao-conclusoes` | Conclusão de refeição do plano |
| `GET/POST …/refeicao-substituicoes` | Substituição persistida (não só UI) |
| `…/treino-sessoes` + `…/series` | Sessão e séries no PostgreSQL |
| `GET …/treino-evolucao` | Log book semanal (segunda–domingo) |
| `POST /api/agent/sessions/:id/messages` | Intent → orquestrador |

### 4.6 WebSocket

Eventos de mensagens, avisos e notificações. Hooks: `useStudentPortalRealtime`, `useCoachPortalRealtime`. Path `/socket.io`.

### 4.7 Schema

Canónico: `schema_adaptado_postgres.sql`. `schema.sql` e `migration/migration_postgres.sql` são históricos.

Domínios principais (não exaustivo):

- Identidade: `app_auth.users`, `profiles`, `user_roles`, `coach_team_members`
- Aluno: `alunos` (inclui `acesso_operacional`), vínculo, `student_access_state`
- Nutrição: `alimentos`, versões, aliases, `dietas`, `itens_dieta`, `dieta_farmacos`, grupos de equivalência
- Execução: `refeicao_conclusoes`, `refeicao_substituicoes`, `refeicoes_registradas`
- Treino: `treinos`, `alunos_treinos`, `atribuicao_overrides`, `aluno_treino_agenda`, `treino_sessoes`, séries
- Progresso: fotos, body metrics, check-ins semanais
- Comunicação: `conversas`, `mensagens`, `avisos`, `notificacoes`
- Financeiro: planos, Asaas, excepções, políticas
- Agente: `agent_sessions`, `agent_runs`, tool calls, approvals
- Coach knowledge: `coach_rules`
- Operações: `email_queue`, agenda, turmas, relatórios

### 4.8 Agente (runtime)

```text
Intent (aluno)
  → POST messages
  → Orchestrator (fast paths + LLM structured JSON)
  → Tool registry (Zod + autonomy)
  → Policy (0–4, bloqueios, HIGH IMPACT)
  → Domain services
  → PostgreSQL
  → Response composer (texto + action cards)
  → UI (thread + cards + open_ui)
```

Flag: `VITE_AGENT_DAILY_ENABLED`. Default ligado; `false` restaura a home clássica de cards (não apagar esse ramo — é fallback de produto, não código morto).

**Phase 7 (Coach Agent HITL) não existe em runtime.**

### 4.9 Deploy e operação

- VPS, PM2, nginx, logrotate
- Email: App → fila PG → Postfix local → `kinghost.smtpkl.com.br:465`; From `no-reply@no-reply.blackhouse.app.br`
- Resend **não** é o relay actual
- Testes: Playwright (`student-mobile`, `coach-desktop`, `auth-desktop`, messaging)
- Guardas: `validate:no-supabase`, `verify:api-contract`

---

## 5. Arquitectura de informação e navegação

### 5.1 Mapa de rotas

```text
PÚBLICO
  /auth                         login, signup, confirm, forgot, reset

COACH / ADMIN
  /                             Index + AppLayout (?tab=)
  /financeiro/*                 hub Asaas (rotas semânticas)
  /alunos/:id                   ficha (tabs)
  /dieta/:id                    editor dieta full-page
  /treino/:id                   editor treino full-page
  /report/:id                   relatório full-page

ALUNO
  /portal-aluno                 portal (?tab=)
  /portal-aluno/blocked         bloqueio financeiro
  /portal-aluno/access-blocked  bloqueio operacional
  /portal-aluno/guia/:id        conteúdo educativo (PDF)
  /aluno                        legacy → mesmo portal
```

### 5.2 Coach — sidebar

Ordem real (`Sidebar.tsx`):

1. Dashboard  
2. Alunos  
3. Treinos  
4. Galeria de Vídeos  
5. Conteúdos Educativos  
6. Nutrição  
7. Mensagens  
8. Check-ins (badge de pendentes, poll 60s)  
9. Agenda  
10. Relatórios de Progresso  
11. Turmas  
12. Avisos em Massa  
13. Vincular Usuários  
14. **Financeiro** (collapsible → rotas `/financeiro/*`)  
15. Configurações  
16. Sair  

Financeiro (rotas, não `?tab=`):

| Path | Função |
|------|--------|
| `/financeiro` | Visão geral |
| `/financeiro/cobrancas` | Cobranças |
| `/financeiro/assinaturas` | Assinaturas |
| `/financeiro/planos` | Planos |
| `/financeiro/clientes` | Clientes |
| `/financeiro/despesas` | Despesas |
| `/financeiro/fluxo-de-caixa` | Fluxo de caixa |
| `/financeiro/relatorios` | Relatórios |
| `/financeiro/integracao` | API key, sandbox, health |
| `/financeiro/configuracoes` | Políticas, excepções, sync |

Tabs `?tab=` antigas de financeiro redireccionam (`LEGACY_TAB_REDIRECTS`).

**Ausentes da sidebar (código existe):** `EventsCalendar` (`?tab=events`), Análises (`?tab=analytics` — placeholder).

Ficha do aluno `/alunos/:id`: Visão geral · Treino (+ agenda) · Nutrição · Progresso (+ refeições registadas) · Financeiro. Inclui card de acesso operacional.

Configurações: Perfil · Utilizadores/papéis · Notificações · Integrações (Asaas, Twilio) · Aparência · Equipa (`assistant` / `viewer`).

### 5.3 Aluno — dois níveis de navegação

**Princípio de layout:** a navegação ocupa o mínimo; o resto pertence ao conteúdo e ao Coleman. Default desktop: rail compacta só com ícones (`bh-student-nav-mode`).

**Bottom nav (mobile, 4 tabs):** Hoje · Dieta · Treino · Coach  

**Sidebar / drawer:**

| Grupo | Tabs |
|-------|------|
| Primário | Hoje, Dieta, Treinos, Coach, Check-in |
| Mais | Fotos e métricas, Vídeos, Relatórios, Financeiro, Perfil |

FAB «Coleman» regressa à home do agente a partir de outras tabs.

Continuidade: action card `open_ui` grava `bh-agent-resume`; ao voltar a Hoje o agente retoma («Voltei»).

---

## 6. Experiência do utilizador — jornadas

### 6.1 Aluno — dia típico (caminho feliz)

```text
Abre /portal-aluno?tab=hoje
  → onboarding (1ª vez) e/ou wizard de perfil se incompleto
  → header COLEMAN
  → briefing local 1×/dia (hora, refeição, treino, pendências)
  → chips contextuais (máx. 4)
  → «Mais do dia» recolhido no mobile
  → conversa: «o que faço agora?» / «concluí» / «trocar X»
  → action card → confirma → opcional Desfazer
  → se treino: open_ui → sessão guiada (séries no servidor)
  → se restaurante: open_ui foto → revisão humana → guarda
```

**Critérios de aceite da home**

- Com `VITE_AGENT_DAILY_ENABLED=true`, a conversa é o herói visual (não um bento de 4 cards).
- Opening não se repete no mesmo dia (chave de storage versionada).
- Chips reflectem `proxima-acao` + sinais de `me/hoje` (descanso, foto, unread).
- Bloqueado financeira ou operacionalmente: WRITE de plano recusado; deep-link para o ecrã de bloqueio.
- Branding Black House (logo) intacto; Coleman é o especialista **dentro** da marca, não uma marca rival.

### 6.2 Aluno — dieta

1. Timeline de refeições do **cardápio do dia** (rotação A/B: um só plano por dia; banner explica).
2. Checklist: conclusão persistida em PostgreSQL (não só `localStorage`).
3. Detalhe (`MealDetailSheet`): todos os itens alcançáveis por scroll (incl. 6.º no Android).
4. Substituição por equivalência de macros; escolha persistida (`refeicao_substituicoes`); o agente pode recomendar + aplicar com confirmação e `clear_substitution`.
5. Anéis de macros coerentes com porções efectivas (após substituições).
6. Fármacos/suplementos da dieta visíveis.
7. Refeição livre: card educativo e/ou fluxo foto → IA → revisão → `refeicoes_registradas`.

### 6.3 Aluno — treino

1. Lista de treinos atribuídos + slot da agenda do dia (ou descanso) via `me/hoje`.
2. Expandir exercícios; scroll completo.
3. **Sessão guiada:** timer de descanso, progresso, carga/reps/RPE, skip; estado local como cache + sync para `treino_sessoes` / séries.
4. Histórico de carga hidratado do servidor.
5. Export PDF do treino.
6. **Evolução / log book** (`treino-evolucao`): semana segunda–domingo, determinística, aluno vs. próprio histórico — sem IA.

### 6.4 Aluno — check-in semanal

Wizard em 5 secções. Pendência no Hoje **só desaparece após enviar**, não ao abrir.

| Secção | Conteúdo |
|--------|----------|
| 1. Peso e fotos | Peso kg + fotos (mínimo configurável) |
| 2. Nutrição | Aderência, apetite, suplementação, água, sol, PA/glicemia |
| 3. Treino | Sessões, desafios, cardio + bloco de evolução de cargas |
| 4. Sono | Horas, higiene, despertares |
| 5. Bem-estar | Stress, digestão (Bristol), autoestima, observações |

Perfil incompleto bloqueia o envio e abre o wizard. Streak e countdown visíveis no Hoje. Feedback do coach aparece depois da resposta.

### 6.5 Aluno — progresso e comparação

Hierarquia do comparador (2026-08-11):

1. Período + delta de peso do par Antes↔Depois  
2. Viewport de fotos (área dominante)  
3. Modos: Comparar (default) · Lado a lado · Alinhar  
4. Ângulos em segmented control  
5. «Ajustar comparação» em bottom sheet (zoom, guias, sync, flash)

Copy em pt-BR. Sem overflow horizontal intencional. Timeline por check-in; upload de foto de progresso autenticado.

### 6.6 Aluno — coach, avisos, resto

- Hub Coach: sub-tabs Chat + Avisos; badges de não lidos (chat + avisos).
- Chat 1:1 realtime; marcar lidas sem depender de `destinatario_id`.
- Vídeos da galeria do coach; relatórios recebidos + feedback; financeiro (cobranças, PIX/boleto); perfil (avatar, preferências in-app vs email).

### 6.7 Aluno — bloqueios (UX)

| Ecrã | Causa | O que o aluno pode fazer |
|------|-------|--------------------------|
| `/portal-aluno/blocked` | Asaas `OVERDUE` / `PENDING_AFTER_DUE_DATE` | Ver financeiro, pagar, auth. Resto do portal fechado. |
| `/portal-aluno/access-blocked` | `not_linked`, `access_pending`, `access_suspended`, `access_revoked` | Mensagem do estado; não executa o plano. Coach resolve. |

Os eixos **não** se misturam: pagar não reactiva um aluno suspenso pelo coach; o coach activar não apaga inadimplência.

### 6.8 Coach — onboarding de aluno

Dois cenários reais (ver spec 2026-03-30):

| Cenário | Fluxo |
|---------|--------|
| Aluno novo | Signup (com ou sem `coach_id`) → confirmação de email → vínculo automático por email **ou** vínculo manual em «Vincular Usuários» |
| Aluno com histórico | Coach cria/importa ficha (PDF/CSV/XLSX) → adopt/link do user órfão |

Importação PDF: parse IA + confirmação humana (`parse-pdf` → `confirm` / `confirm-diet`). Não gravar dieta sem confirmação.

Depois do vínculo: atribuir dieta (A/B + data de retorno), atribuir treinos + agenda semanal (DnD, ISO 1–7), plano Asaas, estado operacional `active`.

### 6.9 Coach — semana de operação

```text
Dashboard (atalhos; contagens ainda parciais)
  → Inbox check-ins: filtros, comparação vs anterior, rascunho IA, marcar respondido
  → Chat 1:1
  → Agenda: retornos, snooze, lembretes
  → Financeiro: sync Asaas, excepções para não bloquear falso positivo
  → Avisos em massa / turmas quando precisa de broadcast
```

IA do coach **hoje**: resumo de tendências da carteira + rascunho de resposta ao check-in. Não prioriza carteira sozinha. Não envia mensagens em nome do coach sem o humano.

### 6.10 Auth (ambos)

Login / logout JWT; confirmação de email com reenvio; forgot + reset; alteração de senha autenticada. Signup valida CPF, peso (1–500 kg), altura (100–250 cm), senha ≥ 6.

---

## 7. Requisitos por domínio

Cada item está **implementado** salvo nota em *Lacuna*.

### 7.1 Autenticação e conta

| ID | Recurso | Aceite |
|----|---------|--------|
| AUTH-01 | Registo | Conta criada; com `coach_id`, ficha provisionada |
| AUTH-02 | Login / logout | JWT; logout limpa token |
| AUTH-03 | Confirmação de email | Link + reenvio |
| AUTH-04 | Recuperação de senha | Email com token (fila SMTP) |
| AUTH-05 | Alteração de senha | Senha antiga validada |
| AUTH-06 | Perfil global | `profiles` (nome, avatar) em ambos os lados |

### 7.2 Controlo de acesso

| ID | Recurso |
|----|---------|
| ACC-01 | Bloqueio financeiro (`/blocked`) |
| ACC-02 | Bloqueio operacional (`/access-blocked`) |
| ACC-03 | Gestão na ficha / lista (conceder, suspender, revogar, reactivar) com nota e preservação de dados |
| ACC-04 | Excepções financeiras vs Asaas (evitar OVERDUE fantasma) |
| ACC-05 | Onboarding + wizard de perfil (obrigatório para check-in) |
| ACC-06 | Vínculo automático por email e manual (`link-user`, adopt, dismiss) |

Acesso efectivo = email confirmado + vínculo + `acesso_operacional = active` + financeiro não bloqueado.

### 7.3 Nutrição

**Coach:** lista/CRUD alimentos; catálogo avançado (versões, merge, aliases, quality report, auditoria); criar/editar dieta; rotação A/B por dias **sem misturar cardápios no mesmo dia**; import PDF; histórico de import; fármacos; data de retorno.

**Aluno:** NUT-A01…A09 da jornada §6.2.

Tabelas-chave: `alimentos`, `alimento_versoes`, `alimento_aliases`, `dietas`, `itens_dieta`, `dieta_farmacos`, `refeicoes_registradas`, `refeicao_conclusoes`, `refeicao_substituicoes`.

### 7.4 Treinos

**Coach:** templates (`is_template`); CRUD com exercícios JSON; atribuição + validade; overrides por aluno; preview de quem tem o template; PDF individual/lote; agenda semanal DnD; lives (CRUD de links).

**Aluno:** lista, agenda/hoje, sessão guiada, PDF, evolução semanal.

`aluno_treino_agenda`: UNIQUE por dia; o mesmo treino **pode** repetir em vários dias.

### 7.5 Progresso

Upload foto; timeline; comparativo (§6.5); peso/indicadores e gráficos; comparação campo-a-campo no inbox do coach; PDF de check-in.

### 7.6 Check-ins

Aluno: POST `/api/checkins`; streak; feedback; pendência só após submit.

Coach: inbox (pendentes, respondidos, busca); resposta textual; IA tendências; IA rascunho; compare vs anterior; job de lembretes.

### 7.7 Mensagens, avisos, notificações

Chat 1:1 realtime; mark-read; avisos individual/turma/todos; preferências in-app vs email; popover de notificações nos dois portais.

### 7.8 Financeiro (Asaas)

Planos, cobranças, assinaturas, clientes, despesas, fluxo, relatórios; API key/sandbox/health; webhooks por coach; sync + reconciliação; políticas e excepções; portal aluno com links de pagamento; bloqueio automático ACC-01.

Recorrência **legada** (`RecurringChargesJob`) está desactivada — recorrência via assinaturas Asaas.

### 7.9 Inteligência artificial (não-agente)

| ID | Uso | Notas |
|----|-----|--------|
| AI-01 | Import PDF ficha/dieta | Confirmação humana obrigatória |
| AI-02 | Foto de refeição | Compressão → itens/macros → revisão → gravar |
| AI-03 | Rascunho resposta check-in | Coach copia/edita; não envia sozinho |
| AI-04 | Resumo de tendências | Inbox coach |

Providers configuráveis com fallback (`AI_PROVIDER`, `GEMINI_API_KEY`, etc.).

### 7.10 Coleman / Daily Agent

Ver §8. Requisitos resumidos:

| ID | Recurso |
|----|---------|
| DA-01 | Intent na home (composer + thread + chips + cards) |
| DA-02 | Fast paths: agora, refeição, treino, concluí, atrasado, restaurante, peso, check-in, relatórios, vídeos |
| DA-03 | Action cards com CTA; confirmação; desfazer substituição |
| DA-04 | Deep-link `open_ui` para UIs especializadas |
| DA-05 | Respeitar bloqueios |
| DA-06 | Recusar `modify_diet` / `modify_workout` / financeiro |
| DA-07 | Receitas: `search_recipe_inspiration` (web) alinhada ao plano |
| DA-08 | `coach_rules` no contexto; plano estruturado prevalece em conflito |
| DA-09 | Insight comportamental (Phase 5) |
| DA-10 | Audit: `agent_run` + tool calls + tokens/custo |
| DA-11 | Prompt `v1.5-coleman`: ENTENDE → RECOMENDA → EXPLICA → AGE |

### 7.11 Conteúdo e operação coach

Galeria de vídeos; conteúdos educativos (PDF/artigo/vídeo, ex. refeição livre); relatórios de progresso (templates, mídias, feedback); turmas; avisos; agenda (`agenda_eventos`: tarefas, retornos, snooze).

### 7.12 Admin e qualidade

Acesso cross-coach; adoptar órfãos; papéis; equipa; scripts `db:migrate`, `db:seed-equivalencia`, `verify:api-contract`, `validate:no-supabase`; E2E Playwright.

---

## 8. Coleman — especificação de produto (aluno)

### 8.1 Posicionamento

Coleman é o especialista pessoal em nutrição e performance **dentro** da Black House. Não substitui o coach humano. Não é a marca do produto.

### 8.2 Autonomia

| Nível | Pode | Exemplos |
|-------|------|----------|
| 0 | Consultar | contexto, plano, próxima acção, treino, refeição, regras |
| 1 | Analisar / recomendar | insight, listar substituições, inspiração de receita |
| 2 | Registar execução | concluir refeição, série, peso, aplicar substituição |
| 3 | Acção com aprovação | rascunho de mensagem ao coach |
| 4 | Proibido | alterar dieta/treino, financeiro, acesso |

### 8.3 Tools (runtime)

**READ:** `get_student_context`, `get_today_plan`, `get_next_action`, `get_today_workout`, `get_next_workout`, `get_week_agenda`, `get_meal_detail`, `search_food`, `list_substitutions`, `get_behavioral_insight`, `list_coach_rules`

**WEB:** `search_recipe_inspiration`

**WRITE:** `complete_meal`, `uncomplete_meal`, `log_workout_set`, `complete_workout_session`, `log_body_weight`, `apply_substitution`, `clear_substitution`

**ACTION:** `open_ui`, `schedule_reminder`, `draft_message_to_coach` (approval)

**HIGH (denied):** `modify_diet`, `modify_workout`

### 8.4 UX do agente

- Header COLEMAN + avatar «C»
- Placeholder do composer: «Fale com o Coleman...»
- Opening dinâmico (1ª vez apresenta-se)
- Chips ghost/secundários — conversa > botões
- Cards com confirmação inline
- FAB nas outras tabs
- Analytics: `agent_home_view`, `agent_intent_sent`, `agent_card_action`, `nav_traditional_open`, `agent_return`, `agent_hydrate`, `agent_error`

### 8.5 O que o agente não é

Não é suporte genérico. Não inventa dieta. Não substitui o chat humano. Não opera o painel do coach. Sem voz. Sem wearables. Sem vector KB.

---

## 9. Modelo de dados de execução (o que mudou vs. “app de PDF”)

Antes da Phase 1a, checklist de refeição e cargas podiam viver só no `localStorage` — métricas de aderência mentiam.

Contrato actual:

| Evento | Persistência |
|--------|----------------|
| Refeição do plano concluída | `refeicao_conclusoes` |
| Substituição do dia | `refeicao_substituicoes` |
| Sessão de treino / séries | `treino_sessoes` + séries |
| Peso avulso | body metrics |
| Refeição livre (foto) | `refeicoes_registradas` |
| Aderência agregada | `task_adherence_events` + job `daily-adherence` |
| Semana de treino | motor `treino-evolucao` (segunda–domingo, igual ao check-in) |

A sessão de treino **ainda** usa progresso local como cache de UI; a fonte de verdade para métricas é o servidor. Se a sync falhar, a UX pode parecer completa e a métrica não — isto é risco de produto, não detalhe técnico.

---

## 10. Jobs e side-effects

| Job | Função |
|-----|--------|
| `payment-reminders` | Lembretes de cobrança |
| `checkin-reminders` | Check-in semanal |
| `event-reminders` | Eventos |
| `return-reminders` | Retorno de dieta **e** treino (substitui o job único de expiração de treino na runner actual) |
| `agenda-coach-reminders` | Agenda do coach |
| `financial-sync-worker` | Sync Asaas inbound |
| `financial-reconciliation` | Reconciliação |
| `financial-webhook-health` | Saúde de webhooks |
| `profile-completeness-reminders` | Perfil incompleto |
| `smart-reminders` | Motor contextual (ex. check-in) |
| `daily-adherence` | Aderência diária |
| `email-queue` | Processa fila SMTP (30s); cleanup >30 dias |

`RecurringChargesJob` desactivado de propósito.

---

## 11. Requisitos não funcionais

| ID | Área | Requisito |
|----|------|-----------|
| NFR-01 | Mobile | Sheets com scroll interno; main travado com overlay; alvos ≥44px na bottom nav |
| NFR-02 | Segurança | JWT; RBAC; tools revalidam scope; sem secrets em git; allowlist no context builder |
| NFR-03 | Disponibilidade | PM2 + nginx; fila de email para não perder transaccional |
| NFR-04 | Contrato | Cliente só fala `api-contract.ts` |
| NFR-05 | Idioma | pt-BR (evolução/comparativo incluídos) |
| NFR-06 | Realtime | Socket.io autenticado |
| NFR-07 | Dados | Schema canónico; migrações via runner |
| NFR-08 | Observabilidade financeira | Health Asaas + audit |
| NFR-09 | Agente | p95 intent→primeira resposta útil ≤ 4s sem vision (alvo; medir) |
| NFR-10 | Agente | Cap de tool loop; falha graceful; quota de tokens |
| NFR-11 | Agente | Cada run auditável (tools, tokens, decisão de autonomia) |
| NFR-12 | A11y | Toggle de nav por teclado; `aria-current` na bottom nav; reduced-motion nas spinners |
| NFR-13 | Perf browser | `browserslist`: >0.5%, last 2, Safari/iOS ≥ 15 |

---

## 12. Métricas

Há **duas** North Stars em documentos antigos. Escolher uma e tratar a outra como satélite. Recomendação deste PRD:

| Papel | Métrica | Porquê |
|-------|---------|--------|
| **North Star de relação** | Alunos activos com check-in enviado nas últimas 2 semanas | É o ritual comercial coach↔aluno; já existia antes do agente |
| **North Star de execução** | % de dias com ≥1 `refeicao_conclusoes` **ou** sessão de treino completed | É o que o Coleman foi feito para mover |

Se só se optimizar check-in, o agente parece sucesso sem mudar o dia. Se só se optimizar conclusão de refeição, pode-se ter “aderência” e o coach continuar cego no domingo.

Satélites:

| Métrica | Definição |
|---------|-----------|
| Activação | % alunos com dieta + treino em ≤7 dias após vínculo |
| Resolução no Hoje | % de “o que faço agora?” sem mudar de tab |
| Tempo de resposta check-in | Mediana envio → resposta do coach |
| Inadimplência | % alunos em OVERDUE (após excepções) |
| Qualidade do agente | % tool calls ok; % acções revertidas (`clear_substitution`, uncomplete) |
| Custo | Tokens / aluno / dia vs cap |
| Uso do comparativo | Aberturas / aluno activo |
| Navegação tradicional | Evento `nav_traditional_open` — se disparar sempre, o agente não está a resolver |

Baseline honesta: medir execução **depois** da persistência server-side; números de checklist localStorage não servem.

---

## 13. Dependências externas

- Conta Asaas por coach  
- Credenciais IA (texto + vision)  
- KingHost SMTP transaccional (smtpkl) + Postfix  
- Twilio (opcional, por coach)  
- PostgreSQL + Node na VPS  
- (Opcional) pesquisa web para receitas  

---

## 14. Fora de âmbito (agora)

- Coach Agent / priorização autónoma da carteira (Phase 7)  
- Alteração autónoma de dieta ou treino  
- Voz, wearables, vector knowledge base  
- Multi-agente paralelo  
- App nativa iOS/Android (o portal é web mobile-first)  
- Substituir o chat humano  
- Voltar a Supabase  
- Persona Assistente como produto de primeira classe (até `ProtectedRoute` e UX existirem)  
- Tab Análises do coach  

---

## 15. Roadmap imediato (só o que o código já aponta)

1. **Phase 7 — Coach Agent HITL** (dito “próximo” desde 2026-07-28; ainda não entregue).  
2. UI coach para `coach_rules` (API já existe).  
3. Sync da preferência de nav compacta/expandida para o perfil (hoje só `localStorage`).  
4. Persona `assistant` de ponta a ponta, **ou** retirar da UI de convite até o RBAC de rotas existir.  
5. Medir NFR-09 (latência do agente) em produção — o alvo está escrito, a evidência não.

Não é um roadmap de crescimento de mercado. É a dívida de produto visível. Qualquer “vamos acrescentar X” compete com isto.

---

## 16. Lacunas conhecidas

| Lacuna | Estado |
|--------|--------|
| Tab **Análises** | Placeholder “em desenvolvimento” |
| **EventsCalendar** | Código presente; sem item estável na sidebar |
| Contagens no Dashboard coach | Parcialmente stub |
| Papel **assistant** / **viewer** | Convite e API parciais; rotas coach não listam `assistant` no `ProtectedRoute` |
| Phase 7 Coach Agent | Não implementado |
| REST legacy `/rest/v1/:table` | Ainda pode existir para algumas tabelas; migração gradual |
| Preferência de densidade nav | Só cliente; sem API |
| Dual-write sessão de treino | Cache local + servidor; risco de métrica divergente |
| Inventário `.md` | `INVENTARIO-MD.md` ainda trata os PRDs de Julho como “vivos”; este documento passa a ser o PRD de produto |

Estas lacunas **não** são requisitos entregues.

---

## 17. Glossário

| Termo | Significado |
|-------|-------------|
| **Coleman** | Agente de nutrição/performance na home do aluno |
| **Cardápio A/B** | Variantes de dieta que rodam por dias; nunca as duas no mesmo dia |
| **Check-in** | Relatório semanal do aluno (5 secções) |
| **Refeição livre** | Fora do plano (educativo e/ou foto IA) |
| **Agenda semanal** | Mapa dia ISO → treino |
| **Acesso operacional** | Bloqueio pelo coach, independente de pagamento |
| **Overlay lock** | CSS que esconde bottom nav e trava scroll do main com sheet aberto |
| **Proxima acção** | Resultado determinístico de plano + hora + conclusões |
| **HITL** | Human in the loop (aprovação humana) |
| **Log book** | Evolução semanal de treino, motor determinístico |

---

## 18. Referências

- Arquitectura: [`docs/ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md)  
- Hábitos: [`docs/REGRAS-PARA-NAO-CONFUNDIR.md`](../REGRAS-PARA-NAO-CONFUNDIR.md)  
- PRD recursos (histórico, 2026-07-25): [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md)  
- PRD agentic (histórico, 2026-07-26): [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md)  
- Specs Phase 1a–6: `docs/arquivo/2026-07-26-spec-phase-*`  
- Home AI-first: [`2026-07-31-home-ai-first.md`](2026-07-31-home-ai-first.md)  
- Coleman: [`2026-08-11-coleman-agente-nutricional.md`](2026-08-11-coleman-agente-nutricional.md)  
- Comparador: [`2026-08-11-ux-comparacao-evolucao-fisica.md`](2026-08-11-ux-comparacao-evolucao-fisica.md)  
- Nav compacta: [`2026-07-28-layout-adaptativo-nav.md`](2026-07-28-layout-adaptativo-nav.md)  
- Acesso operacional: [`2026-07-21-gestao-acesso-aluno.md`](2026-07-21-gestao-acesso-aluno.md)  
- Bloqueio vs Asaas: [`2026-07-21-bloqueio-financeiro-vs-asaas.md`](2026-07-21-bloqueio-financeiro-vs-asaas.md)  
- Cadastro aluno: [`2026-03-30-cenarios-cadastro-aluno.md`](2026-03-30-cenarios-cadastro-aluno.md)  
- SMTP: [`2026-08-16-migracao-smtp-kinghost-concluida.md`](2026-08-16-migracao-smtp-kinghost-concluida.md)  

---

*Gerado a partir do código e da documentação vigente em 2026-08-18. Alterações de produto: nova revisão datada em `docs/arquivo/`, não editar este ficheiro como se fosse wiki eterna.*
