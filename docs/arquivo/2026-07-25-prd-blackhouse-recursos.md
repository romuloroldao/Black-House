# PRD — Black House: inventário detalhado de recursos

| Campo | Valor |
|-------|--------|
| **Produto** | Black House — plataforma coach–aluno (saúde integrativa & performance) |
| **Documento** | Product Requirements Document (estado actual do produto) |
| **Data** | 2026-07-25 |
| **Fonte de verdade** | Código em produção + [`docs/ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) |
| **Âmbito** | Todos os recursos implementados (coach, aluno, admin, integrações) |
| **Fora de âmbito** | Roadmap futuro não implementado; pasta `.worktrees/checkpoint/` |

---

## 1. Visão do produto

### 1.1 Problema

Coaches de performance/nutrição gerem alunos em ferramentas fragmentadas (WhatsApp, PDFs, planilhas, gateways de pagamento). O aluno perde contexto do plano diário, aderência e evolução. O coach perde tempo a responder check-ins, cobrar e manter dietas/treinos actualizados.

### 1.2 Solução

Plataforma única onde o **coach** opera o negócio (alunos, planos, financeiro, comunicação) e o **aluno** consome o plano no telemóvel (hoje, dieta, treino, check-in, fotos, chat), com cobrança Asaas e bloqueios de acesso claros.

### 1.3 Proposta de valor

| Stakeholder | Valor |
|-------------|--------|
| **Coach** | Operação centralizada: ficha do aluno, dietas A/B, treinos + agenda, inbox de check-ins com IA, chat, avisos, Asaas. |
| **Aluno** | Portal mobile-first: o que fazer hoje, dieta com substituições, treino do dia, check-in semanal, evolução fotográfica, pagamento. |
| **Negócio** | Relação comercial coach→aluno com controlo financeiro e operacional de acesso. |

### 1.4 Princípios de produto

1. **Coach é o centro comercial** — o aluno não existe de forma autónoma sem vínculo (excepto signup com `coach_id`).
2. **Mobile-first no aluno** — bottom nav + sheets; gestos e scroll pensados para Android/iOS.
3. **Dois eixos de bloqueio independentes** — financeiro (Asaas) vs operacional (coach).
4. **Português (pt-BR)** como idioma de produto.
5. **Stack canónica** — React/Vite + Express + PostgreSQL + JWT (sem Supabase em runtime).

### 1.5 Arquitectura (resumo)

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + Vite 5 + TypeScript + React Router |
| Backend | Node.js + Express + Socket.io |
| BD | PostgreSQL (`schema_adaptado_postgres.sql`) |
| Auth | JWT + `app_auth.users` |
| Contrato HTTP | `/api/*` + `src/contracts/api-contract.ts` |
| Realtime | Socket.io path `/socket.io` |

---

## 2. Personas e papéis

### 2.1 Coach

Operador principal. Painel em `/` com sidebar de módulos. Gere alunos, planos, comunicação e financeiro.

### 2.2 Aluno

Consumidor do plano. Portal em `/portal-aluno/*`, navegação por tabs. Experiência orientada a “o que faço hoje”.

### 2.3 Admin

Super-utilizador: acesso a todas as rotas do painel coach; operações cross-coach (vincular alunos a coaches, Asaas/Twilio por coach, papéis). Bypass em `ProtectedRoute`.

### 2.4 Assistente (`assistant`)

Membro de equipa (`coach_team_members`). Permissões parciais na API (agenda, check-ins, métricas). Usa UI de coach com restrições no backend — sem portal dedicado.

### 2.5 Gestão de papéis

Configurações → Papéis de utilizador (`UserRolesManager`): `coach`, `aluno`, `assistant`, `admin`.

---

## 3. Jobs-to-be-done (JTBD)

| Persona | Job | Resultado esperado |
|---------|-----|-------------------|
| Coach | “Quando um aluno entra, quero ficha + dieta + treino + cobrança num sítio” | Onboarding completo sem WhatsApp |
| Coach | “Quando chega o check-in semanal, quero responder rápido com contexto” | Inbox + IA + comparação |
| Coach | “Quando o aluno atrasa pagamento, quero bloquear o portal sem perder o vínculo” | Bloqueio financeiro automático |
| Aluno | “Quando abro a app de manhã, quero saber o que comer e treinar hoje” | Ecrã Hoje + agenda |
| Aluno | “Quando a dieta tem opções, quero trocar alimentos sem perguntar ao coach” | Substituições por equivalência |
| Aluno | “Quando como fora do plano, quero registar a refeição” | Foto → estimativa IA → histórico |
| Aluno | “Quando quero ver progresso, quero comparar fotos Antes/Depois” | Comparativo com pan/zoom |

---

## 4. Requisitos por domínio

Cada recurso abaixo está **implementado** salvo indicação explícita de lacuna.

---

### 4.1 Autenticação e conta

| ID | Recurso | Descrição | Critérios de aceite |
|----|---------|-----------|---------------------|
| AUTH-01 | Registo | Nome, email, CPF, peso, altura, senha; `coach_id` opcional no signup | Conta criada; se `coach_id`, ficha de aluno provisionada |
| AUTH-02 | Login / logout | JWT | Sessão válida; logout limpa token |
| AUTH-03 | Confirmação de email | Token + reenvio | Link confirma; reenvio funciona |
| AUTH-04 | Recuperação de senha | Forgot + reset | Email com token; senha actualizada |
| AUTH-05 | Alteração de senha | Utilizador autenticado | Senha antiga validada |
| AUTH-06 | Perfil global | `profiles` (nome, avatar) | Visível em coach e aluno |

---

### 4.2 Controlo de acesso do aluno

Dois eixos **independentes**:

| ID | Eixo | Ecrã | Gatilhos | Comportamento |
|----|------|------|----------|---------------|
| ACC-01 | **Financeiro** | `/portal-aluno/blocked` | `OVERDUE`, `PENDING_AFTER_DUE_DATE` | Bloqueia portal excepto financeiro e auth |
| ACC-02 | **Operacional** | `/portal-aluno/access-blocked` | `not_linked`, `access_pending`, `access_suspended`, `access_revoked` | Coach controla via `student_access_state` / `acesso_operacional` |

| ID | Recurso | Descrição |
|----|---------|-----------|
| ACC-03 | Gestão coach | `StudentPortalStatusCard` / ficha do aluno — suspender, revogar, activar |
| ACC-04 | Excepções financeiras | Políticas e excepções que evitam falso positivo vs Asaas |
| ACC-05 | Onboarding | Boas-vindas + wizard de perfil incompleto (obrigatório para check-in) |
| ACC-06 | Vínculo | Automático por email; manual (`UserLinkingManager`, `/api/alunos/link-user`) |

---

### 4.3 Portal do aluno

#### 4.3.1 Navegação principal (bottom nav)

| ID | Tab | Componente | Requisitos |
|----|-----|------------|------------|
| ALU-HOJE | Hoje | `StudentTodayView` | Hero do dia; pendências (check-in, avisos); cards dieta/treino; streak; foto da semana; feedback coach; eventos. Dados: `/api/alunos/me/hoje` |
| ALU-DIETA | Dieta | `StudentDietView` | Ver 4.4 (consumo) |
| ALU-TREINO | Treino | `StudentWorkoutsView` | Ver 4.5 (consumo) |
| ALU-COACH | Coach | `StudentCoachHubView` | Sub-tabs Chat + Avisos; badges de não lidos |

#### 4.3.2 Menu “Mais”

| ID | Tab | Requisitos |
|----|-----|------------|
| ALU-CHK | Check-in | Formulário semanal 5 secções (ver 4.7) |
| ALU-FOT | Fotos e métricas | Timeline, peso, gráficos, comparativo (ver 4.6) |
| ALU-VID | Vídeos | Biblioteca do coach |
| ALU-REL | Relatórios | Relatórios enviados pelo coach + feedback |
| ALU-FIN | Financeiro | Cobranças, status, links boleto/PIX |
| ALU-PRF | Perfil | Dados pessoais, avatar, preferências de notificação |

#### 4.3.3 Rotas dedicadas

| ID | Rota | Função |
|----|------|--------|
| ALU-GUIA | `/portal-aluno/guia/:contentId` | Conteúdo educativo (PDF inline) |
| ALU-BLK | `/blocked`, `/access-blocked` | Bloqueios |
| ALU-RT | Realtime | `useStudentPortalRealtime` + notificações |

---

### 4.4 Nutrição

#### Coach

| ID | Recurso | Descrição |
|----|---------|-----------|
| NUT-C01 | Lista de alimentos | Consulta rápida |
| NUT-C02 | Gerir alimentos | CRUD legado `/api/alimentos` |
| NUT-C03 | Catálogo avançado | Versões, merge, aliases, quality report, auditoria |
| NUT-C04 | Criar/editar dieta | Refeições, itens, macros, planos A/B, fármacos |
| NUT-C05 | Rotação A/B | Configuração por dias; não misturar cardápios no mesmo dia |
| NUT-C06 | Importação PDF | Parse IA + confirmação (`/api/import/parse-pdf`, `confirm-diet`) |
| NUT-C07 | Histórico import | Por aluno |
| NUT-C08 | Ficha aluno → Nutrição | Atribuir dieta, data de retorno, itens |

#### Aluno

| ID | Recurso | Descrição | Critérios de aceite |
|----|---------|-----------|---------------------|
| NUT-A01 | Dieta activa | Timeline de refeições | Refeições do plano visíveis |
| NUT-A02 | Rotação A/B | Banner + plano do dia | Só o cardápio do dia |
| NUT-A03 | Checklist diário | LocalStorage por dia | Marcar refeição feita |
| NUT-A04 | Detalhe refeição | `MealDetailSheet` | Lista completa scrollável (incl. 6.º item no Android) |
| NUT-A05 | Substituições | Equivalência por macros | Abrir dialog; aplicar substituto |
| NUT-A06 | Macros | Anéis / totais | Valores coerentes com porções |
| NUT-A07 | Fármacos | Suplementos da dieta | Visíveis no plano |
| NUT-A08 | Refeição livre (edu) | Card → conteúdo educativo | Abre guia |
| NUT-A09 | Refeição livre (foto) | Foto → IA → revisão → guardar | Itens/macros editáveis; histórico na ficha |

#### Dados

Tabelas: `alimentos`, `tipos_alimentos`, `alimento_versoes`, `alimento_aliases`, `alimento_audit_log`, `dietas`, `itens_dieta`, `dieta_farmacos`, `refeicoes_registradas`, `refeicao_registrada_itens`.

---

### 4.5 Treinos

#### Coach

| ID | Recurso | Descrição |
|----|---------|-----------|
| TRN-C01 | Templates | `treinos` com `is_template` |
| TRN-C02 | CRUD treino | Exercícios JSON, categoria, dificuldade, duração |
| TRN-C03 | Atribuição | `/api/alunos-treinos/assign` + validade + aviso de expiração |
| TRN-C04 | Overrides | Personalização por aluno (add/remove exercícios) |
| TRN-C05 | Preview / sheet atribuições | Visualizar e gerir quem tem o template |
| TRN-C06 | Export PDF | Individual e lote |
| TRN-C07 | Agenda semanal | Editor DnD (`WeeklyWorkoutAgendaEditor`) — dia ISO 1–7 → treino |
| TRN-C08 | Lives | CRUD links de transmissão (`lives`) |

#### Aluno

| ID | Recurso | Descrição | Critérios de aceite |
|----|---------|-----------|---------------------|
| TRN-A01 | Lista de treinos | Treinos atribuídos | Cards com metadados |
| TRN-A02 | Agenda / hoje | Slot do dia ou descanso | `/api/alunos/me/hoje` reflecte agenda |
| TRN-A03 | Ver exercícios | Expandir lista | Todos os exercícios alcançáveis por scroll |
| TRN-A04 | Sessão guiada | Timer, progresso local | Sessão completa sem perder estado |
| TRN-A05 | Export PDF | Do treino seleccionado | Ficheiro gerado |

#### Dados

`treinos`, `alunos_treinos`, `atribuicao_overrides`, `aluno_treino_agenda` (UNIQUE por dia; sem UNIQUE no treino — mesmo treino em vários dias).

---

### 4.6 Progresso e evolução

| ID | Recurso | Persona | Descrição |
|----|---------|---------|-----------|
| PRG-01 | Upload foto | Aluno | `/api/uploads/progress-photo` |
| PRG-02 | Timeline | Aluno / Coach | `EvolutionTimelineExperience` — cards por check-in |
| PRG-03 | Comparativo | Aluno | `CompareEvolutionWorkspace`: Antes (mais antiga) \| Depois (mais recente); modos deslizante / lado a lado / flash; pan/zoom **independente** por lado; máscara só via slider ou linha |
| PRG-04 | Trocar lados / semanas | Aluno | Selects + botão trocar |
| PRG-05 | Peso / indicadores | Ambos | Histórico + gráficos |
| PRG-06 | Compare check-in coach | Coach | `CheckinSideBySideCompare` |
| PRG-07 | PDF check-in | Coach | Export |

Copy do comparativo: sempre pt-BR (`tEvolution` fixado).

---

### 4.7 Check-ins semanais

#### Aluno — formulário em 5 secções

| Secção | Conteúdo |
|--------|----------|
| 1. Peso e fotos | Peso kg + fotos (mínimo configurável) |
| 2. Nutrição | Aderência, apetite, suplementação, água, sol, PA/glicemia |
| 3. Treino | Sessões, desafios, cardio |
| 4. Sono | Horas, higiene, despertares |
| 5. Bem-estar | Stress, digestão (Bristol), autoestima, observações |

| ID | Recurso | Critérios |
|----|---------|-----------|
| CHK-A01 | Enviar check-in | POST `/api/checkins`; perfil completo obrigatório |
| CHK-A02 | Streak / countdown | Visível no Hoje |
| CHK-A03 | Feedback coach | Visível após resposta |
| CHK-A04 | Pendência | Some só após **enviar**, não só ao abrir |

#### Coach — inbox

| ID | Recurso |
|----|---------|
| CHK-C01 | Inbox com filtros (pendentes, respondidos, prioridade, busca) |
| CHK-C02 | Resposta textual + marcar respondido |
| CHK-C03 | IA: resumo de tendências |
| CHK-C04 | IA: rascunho de resposta |
| CHK-C05 | Comparação campo-a-campo vs check-in anterior |
| CHK-C06 | Lembretes automáticos (`checkin-reminders.job.js`) |

---

### 4.8 Mensagens, avisos e notificações

| ID | Recurso | Descrição |
|----|---------|-----------|
| MSG-01 | Chat 1:1 | `conversas` + `mensagens`; coach e aluno |
| MSG-02 | Realtime | Socket.io: join, `new_message` |
| MSG-03 | Marcar lidas | `POST /api/mensagens/mark-read` (sem depender de `destinatario_id`) |
| MSG-04 | Avisos em massa | Individual / turma / todos → `avisos` + destinatários |
| MSG-05 | Avisos no aluno | Tab Avisos; marcar lido |
| MSG-06 | Notificações in-app | `notificacoes` + popover |
| MSG-07 | Preferências | In-app vs in-app+email |

---

### 4.9 Financeiro e Asaas

#### Hub coach (`/financeiro/*`)

| Rota | Função |
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

| ID | Recurso |
|----|---------|
| FIN-01 | Planos e cobranças Asaas |
| FIN-02 | Assinaturas / clientes |
| FIN-03 | Webhooks por coach |
| FIN-04 | Sync + reconciliação + health jobs |
| FIN-05 | Excepções financeiras (evitar OVERDUE fantasma) |
| FIN-06 | Portal aluno: histórico + links de pagamento |
| FIN-07 | Bloqueio automático por inadimplência (ACC-01) |

---

### 4.10 Inteligência artificial

| ID | Caso de uso | Provider típico | Endpoint / serviço |
|----|-------------|-----------------|-------------------|
| AI-01 | Import PDF ficha/dieta | Groq/OpenAI/Gemini (+ multimodal PDF) | `ai.service.js`, `/api/import/parse-pdf` |
| AI-02 | Análise foto refeição | Gemini Vision | `meal-photo-ai.service.js`, `/api/refeicoes-registradas/analyze` |
| AI-03 | Rascunho resposta check-in | Texto IA | `/weekly-checkins/:id/ai/draft-response` |
| AI-04 | Resumo tendências check-ins | Texto IA | `/weekly-checkins/ai/trends-summary` |

Config: `AI_PROVIDER`, `AI_API_KEY`, `GEMINI_API_KEY`, `AI_VISION_PROVIDER`, com fallback entre providers.

**Fluxo AI-02:** foto → compressão → extracção itens/macros → revisão humana → `refeicoes_registradas`.

---

### 4.11 Conteúdo e comunicação em massa

| ID | Recurso |
|----|---------|
| CNT-01 | Galeria de vídeos (CRUD coach → consumo aluno) |
| CNT-02 | Conteúdos educativos (PDF/artigo/vídeo) — p.ex. refeição livre |
| CNT-03 | Relatórios de progresso (criar, enviar, templates, mídias, feedback) |
| CNT-04 | Turmas (grupos coloridos de alunos) |
| CNT-05 | Avisos em massa (ver MSG-04) |
| CNT-06 | Agenda do coach (`agenda_eventos`: tarefas, retornos, snooze) |

---

### 4.12 Painel coach — módulos de navegação

| Módulo sidebar | Capacidades principais |
|----------------|------------------------|
| Dashboard | Resumo, atalhos, busca global |
| Alunos | CRUD, filtros, import PDF/CSV/XLSX, ficha `/alunos/:id` |
| Treinos | Templates, assign, PDF |
| Galeria de Vídeos | CRUD |
| Conteúdos Educativos | CRUD |
| Nutrição | Alimentos + catálogo + dietas |
| Mensagens | Inbox 1:1 |
| Check-ins | Inbox semanal + IA |
| Agenda | Eventos / retornos |
| Relatórios de Progresso | Envio e templates |
| Turmas | Grupos |
| Avisos em Massa | Broadcast |
| Vincular Usuários | Órfãos / adopt |
| Financeiro | Hub Asaas |
| Configurações | Perfil, senha, Asaas, Twilio, equipa, papéis, notificações |

#### Ficha do aluno (`/alunos/:id`)

Tabs: Visão geral · Treino (+ agenda) · Nutrição · Progresso (+ refeições registadas) · Financeiro.

Rotas full-page: `/dieta/:id`, `/treino/:id`, `/report/:id`.

---

### 4.13 Integrações e jobs

| Integração | Uso |
|------------|-----|
| Asaas | Cobranças, assinaturas, webhooks, sync |
| Twilio | SMS/config por coach |
| SMTP / Resend | Email transacional (confirmação, reset, lembretes) |

Jobs relevantes: lembretes de pagamento, check-in, agenda coach, expiração de treino, sync financeiro, reconciliação, perfil incompleto.

---

### 4.14 Admin e operações

| ID | Recurso |
|----|---------|
| ADM-01 | Acesso cross-coach a recursos |
| ADM-02 | Vincular órfãos a um coach |
| ADM-03 | Promover/rebaixar papéis |
| ADM-04 | Equipa do coach (`assistant` / `viewer`) |
| ADM-05 | Scripts: `db:migrate`, `db:seed-equivalencia`, `verify:api-contract`, `validate:no-supabase` |
| ADM-06 | E2E Playwright (aluno mobile, coach desktop, auth, messaging) |

---

## 5. Requisitos não funcionais

| ID | Área | Requisito |
|----|------|-----------|
| NFR-01 | Performance mobile | Sheets com scroll interno fiável; main do portal travado quando overlay aberto |
| NFR-02 | Segurança | JWT; RBAC por papel; sem secrets em commits |
| NFR-03 | Disponibilidade | PM2 + nginx; logrotate |
| NFR-04 | Contrato API | Cliente só chama endpoints em `api-contract.ts` |
| NFR-05 | Idioma | UI aluno (evolução/comparativo) em português |
| NFR-06 | Realtime | Socket.io autenticado por JWT |
| NFR-07 | Dados | Schema canónico `schema_adaptado_postgres.sql` |
| NFR-08 | Observabilidade financeira | Health check Asaas + audit log |

---

## 6. Mapa de ecrãs (resumo)

```
COACH / ADMIN                         ALUNO
├── Dashboard                         ├── Hoje
├── Alunos + ficha                    ├── Dieta (+ foto livre)
├── Treinos + agenda                  ├── Treinos (+ agenda + sessão)
├── Nutrição                          ├── Coach (chat + avisos)
├── Mensagens                         ├── Check-in
├── Check-ins (+ IA)                  ├── Fotos / comparativo
├── Agenda                            ├── Vídeos
├── Relatórios                        ├── Relatórios
├── Turmas + Avisos                   ├── Financeiro
├── Vincular usuários                 └── Perfil
├── Financeiro / Asaas
└── Configurações
```

---

## 7. Métricas sugeridas (North Star e satélites)

| Métrica | Definição |
|---------|-----------|
| **North Star** | Alunos activos com check-in enviado nas últimas 2 semanas |
| Activação | % alunos com dieta + treino atribuídos em ≤7 dias após vínculo |
| Aderência dieta | % dias com checklist ≥1 refeição marcada |
| Sessões de treino | Sessões iniciadas / semana |
| Tempo de resposta check-in | Mediana coach (hora do envio → resposta) |
| Inadimplência | % alunos em OVERDUE |
| Refeições livres | Registos foto/semana com status guardado |
| Uso do comparativo | Aberturas do dialog Comparar / aluno activo |

---

## 8. Lacunas conhecidas (estado actual)

| Lacuna | Notas |
|--------|-------|
| Tab **Análises** | Placeholder “em desenvolvimento” |
| **EventsCalendar** | Código presente; sem entrada estável no sidebar |
| Contagens no Dashboard coach | Parcialmente stub |
| Papel **assistant** | API pronta; UX dedicada limitada |
| REST legacy `/rest/v1/:table` | Ainda activo para algumas tabelas; migração gradual |

Estas lacunas **não** são requisitos entregues; listam-se para transparência do PRD “as-built”.

---

## 9. Dependências externas

- Conta Asaas (por coach)
- Credenciais IA (texto + vision)
- SMTP / Resend
- Twilio (opcional)
- PostgreSQL + Node runtime na VPS

---

## 10. Glossário

| Termo | Significado |
|-------|-------------|
| Cardápio A/B | Variantes de dieta que rodam por dias |
| Check-in | Relatório semanal do aluno |
| Refeição livre | Refeição fora do plano (educativo e/ou foto IA) |
| Agenda semanal | Mapa dia→treino do aluno |
| Acesso operacional | Bloqueio pelo coach, independente de pagamento |
| Overlay lock | Classe/`index.css` que esconde bottom nav e trava scroll do main |

---

## 11. Referências internas

- Arquitectura: [`docs/ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md)
- Hábitos de documentação: [`docs/REGRAS-PARA-NAO-CONFUNDIR.md`](../REGRAS-PARA-NAO-CONFUNDIR.md)
- Onboarding aluno: [`docs/arquivo/2026-03-30-cenarios-cadastro-aluno.md`](2026-03-30-cenarios-cadastro-aluno.md)
- Acesso operacional: [`docs/arquivo/2026-07-21-gestao-acesso-aluno.md`](2026-07-21-gestao-acesso-aluno.md)
- Bloqueio financeiro vs Asaas: [`docs/arquivo/2026-07-21-bloqueio-financeiro-vs-asaas.md`](2026-07-21-bloqueio-financeiro-vs-asaas.md)
- Roadmap: [`docs/arquivo/2026-06-07-roadmap-atualizado.md`](2026-06-07-roadmap-atualizado.md)

---

*Documento gerado a partir do inventário do código em 2026-07-25. Para alterações de produto, actualizar este PRD ou criar revisão datada em `docs/arquivo/`.*
