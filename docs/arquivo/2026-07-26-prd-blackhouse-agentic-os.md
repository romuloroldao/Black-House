# PRD — Black House Agentic Operating System

| Campo | Valor |
|-------|--------|
| **Produto** | Black House |
| **Documento** | PRD complementar (estado futuro agentic) |
| **Data** | 2026-07-26 |
| **Relação** | Complementa — **não substitui** — o PRD as-built [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md) |
| **Auditoria** | [`2026-07-26-auditoria-agentic-os.md`](2026-07-26-auditoria-agentic-os.md) |
| **Specs** | Phase 1a / 1b / 2 (ficheiros datados no mesmo directório) |

```text
PRD as-built (recursos actuais)
        ↓
Estado existente (código + inventário)
        ↓
PRD Agentic (este documento)
        ↓
Estado futuro (fases 1a → 7)
```

---

## 1. Visão

A Black House evolui de uma plataforma de consultoria (aluno navega para encontrar dieta/treino) para um **Sistema Operacional de Acompanhamento Personalizado**: o aluno expressa intenção; o sistema compreende o contexto do plano; conduz a próxima acção; regista o resultado; actualiza o contexto.

A conversa e a linguagem natural são a **interface principal de intenção**. Interfaces visuais especializadas continuam a existir quando forem superiores (editor de dieta, sessão de treino, gráficos, comparativo de fotos).

---

## 2. Problema

Hoje o aluno tipicamente:

```text
Entra → procura treino → procura dieta → procura cardio → procura feedback → decide
```

Isto gera fricção, baixa aderência e métricas de execução ilusórias (checklist e cargas só em `localStorage`). O coach não vê a execução diária real; a IA existente ajuda import/foto/rascunhos, mas **não opera o dia do aluno**.

---

## 3. Hipótese

> O aluno pode executar o seu plano com **menos navegação** e **mais orientação contextual** através de uma interface agentic ligada a dados reais e tools controladas.

Hipótese secundária:

> O conhecimento e o método do coach podem tornar-se uma camada operacional (`coach_rules` + tools) que o agente usa com autonomia limitada e auditoria.

---

## 4. Princípios

1. **Zero navegação desnecessária** — a próxima acção deve ser alcançável a partir do Hoje.
2. **Intenção + UI especializada** — não transformar tudo em chat.
3. **Determinístico primeiro** — plano, horário, conclusões e permissões vêm do domínio; LLM interpreta e comunica.
4. **Tools, não SQL** — o agente nunca acede à BD directamente.
5. **Autonomia explícita** — níveis 0–4; HIGH IMPACT sempre humano.
6. **Incremental** — reutilizar portal, `getAlunoHoje`, AI providers, RBAC.
7. **Telemetria real** — execução diária no PostgreSQL antes de “inteligência”.
8. **Coach no centro comercial** — o agente do aluno respeita vínculo, acesso financeiro e operacional.
9. **pt-BR** como idioma de produto.
10. **Observabilidade** — cada run e tool call auditável.

---

## 5. Personas

| Persona | Papel no OS agentic |
|---------|---------------------|
| **Aluno** | Utilizador primário do Daily Agent; executa plano |
| **Coach** | Dono do método; aprovador de HIGH IMPACT; utilizador futuro do Coach Agent |
| **Assistente** | Mesmo scope do coach onde a API já permite; sem agente próprio no MVP |
| **Admin** | Operações cross-coach; configuração; não é utilizador do Daily Agent |

---

## 6. Jobs-to-be-done

| Persona | Job | Resultado |
|---------|-----|-----------|
| Aluno | “Quando abro a app, quero saber o que fazer agora sem caçar ecrãs” | Próxima acção + card executável |
| Aluno | “Quando acabo uma refeição, quero registar sem abrir a dieta completa” | `complete_meal` via intent/card |
| Aluno | “Quando treino, quero ser conduzido série a série” | Guided workout (fase 3) |
| Aluno | “Quando estou num restaurante, quero ajuda alinhada ao plano” | Foto → análise → decisão (fase 2/4) |
| Coach | “Quando o aluno executa, quero ver aderência real” | Logs server-side |
| Coach | “Quando respondo check-ins, quero rascunhos com contexto” | Já parcial; Coach Agent fase 7 |

---

## 7. Casos de uso (MVP e adjacentes)

### MVP (Phase 2)

| ID | Caso | Actor |
|----|------|-------|
| UC-01 | “O que faço agora?” | Aluno |
| UC-02 | “Qual minha próxima refeição?” | Aluno |
| UC-03 | “Qual meu treino de hoje?” | Aluno |
| UC-04 | “Concluí.” (refeição ou passo actual) | Aluno |
| UC-05 | “Estou atrasado.” | Aluno |
| UC-06 | “Estou num restaurante.” → abrir fluxo foto | Aluno |

### Pós-MVP

| ID | Caso | Fase |
|----|------|------|
| UC-10 | Sessão guiada série/carga/reps/RPE | 3 |
| UC-11 | Substituir alimento e persistir escolha | 4 |
| UC-12 | Lista de compras do dia/semana | 4 |
| UC-13 | Alerta proactivo de queda de aderência | 5 |
| UC-14 | Coach: priorizar carteira / rascunhos supervisionados | 7 |

---

## 8. Requisitos funcionais

### 8.1 Execução diária (Phase 1a) — pré-requisito

| ID | Requisito |
|----|-----------|
| EX-01 | Concluir/desconcluir refeição do plano persiste no PostgreSQL |
| EX-02 | Sessão de treino e séries (carga, reps, RPE, dor opcional) persistem no PostgreSQL |
| EX-03 | UI actual de dieta/treino deixa de depender só de `localStorage` (migração com fallback curto) |
| EX-04 | APIs autenticadas self-scope do aluno |
| EX-05 | Eventos de aderência (`task_adherence_events`) para meal/workout quando aplicável |

### 8.2 Foundation (Phase 1b)

| ID | Requisito |
|----|-----------|
| AF-01 | Sessões e mensagens de agente |
| AF-02 | Runs com tool calls auditados |
| AF-03 | Tool registry com Zod, autonomia, idempotência |
| AF-04 | Policy engine (níveis 0–4) |
| AF-05 | Context builder sobre `getAlunoHoje` + execução |
| AF-06 | Logging de tokens/custo/latência por run |
| AF-07 | Rate limit específico de intent/agent |

### 8.3 Daily Agent (Phase 2)

| ID | Requisito |
|----|-----------|
| DA-01 | Intent surface no ecrã Hoje (bar + sheet) |
| DA-02 | Resolver UC-01…UC-06 com dados reais |
| DA-03 | Action cards com CTA (`open_ui`, `complete_meal`, etc.) |
| DA-04 | Deep-link para Dieta, Treino, Foto, Check-in |
| DA-05 | Respeitar bloqueios financeiro/operacional |
| DA-06 | Sem alterar dieta/treino/financeiro |

---

## 9. Requisitos não funcionais

| ID | Área | Requisito |
|----|------|-----------|
| NFR-A01 | Latência | p95 intent→primeira resposta útil ≤ 4s (sem vision) |
| NFR-A02 | Fiabilidade | Tool loop com cap; retries provider; falha graceful |
| NFR-A03 | Segurança | Isolamento tenant; sem SQL livre; audit |
| NFR-A04 | Custo | Quota tokens/aluno/dia configurável |
| NFR-A05 | Mobile | Intent usable com uma mão; pt-BR |
| NFR-A06 | Compatibilidade | Stack canónica; contrato em `api-contract.ts` |
| NFR-A07 | Observabilidade | Run id, tool calls, erros, tokens |
| NFR-A08 | Testes | Unit tools + integration intent happy path |

---

## 10. Arquitectura

Ver auditoria §6. Resumo: Intent API → Orchestrator (structured output) → Tool Layer → Domain Services → PostgreSQL; UI especializada via cards/deep-links.

Decisão MVP: **orquestrador próprio + structured JSON** (não depender de function-calling nativo de um único provider).

---

## 11. Memória

| Tipo | Fonte | Persistência |
|------|-------|--------------|
| Contexto actual | `getAlunoHoje` + conclusões + sessão treino | Request + PG |
| Histórico | Check-ins, peso, fotos, refeições livres, logs | PG |
| Perfil | `alunos` + preferências | PG |
| Sessão agente | Mensagens recentes | `agent_*` |
| Filosofia coach | `coach_rules` (fase 6) | PG tipado |
| KB textual | Opcional embeddings (fase 6) | Só se justificado |

---

## 12. Agentes

| Agente / skill | Quando | Autonomia |
|----------------|--------|-----------|
| **Daily Agent** (orquestrador aluno) | MVP | 0–2 |
| Nutrition skill | Fase 4 | 0–2 (+3 gated) |
| Training skill | Fase 3 | 0–2 |
| Progress skill | Fase 5 | 0–1 |
| Coach Agent | Fase 7 | 1–3 HITL |

MVP = um orquestrador, não frota de agentes.

---

## 13. Tools (MVP)

| Tool | Classe | Autonomia |
|------|--------|-----------|
| `get_student_context` | READ | 0 |
| `get_today_plan` | READ | 0 |
| `get_next_action` | READ | 0 |
| `get_today_workout` | READ | 0 |
| `get_meal_detail` | READ | 0 |
| `list_substitutions` | READ | 0 |
| `complete_meal` | WRITE | 2 |
| `uncomplete_meal` | WRITE | 2 |
| `log_workout_set` | WRITE | 2 |
| `complete_workout_session` | WRITE | 2 |
| `log_body_weight` | WRITE | 2 |
| `save_meal_photo_analysis` | WRITE | 2 |
| `open_ui` | ACTION | 2 |
| `schedule_reminder` | ACTION | 2 |
| `draft_message_to_coach` | ACTION | 3 |
| `modify_diet` / `modify_workout` / financeiro / acesso | HIGH | 4 ❌ |

Contratos detalhados na spec 1b.

---

## 14. Autonomia

| Nível | Permissão |
|-------|-----------|
| 0 | Consultar |
| 1 | Analisar / recomendar / rascunhar |
| 2 | Registar execução baixo risco |
| 3 | Acções com aprovação explícita do utilizador |
| 4 | Exclusivamente humanas / proibidas ao agente |

---

## 15. Segurança

- JWT + RBAC existentes; tools revalidam scope.
- Allowlist de campos no context builder.
- Prompt injection: validação Zod; system/developer prompts imutáveis por request.
- Rate limit + quotas.
- Audit de decisões e tool calls.
- Aluno bloqueado: orchestrator recusa com mensagem de acesso (deep-link financeiro/operacional).

---

## 16. Observabilidade

Por `agent_run`:

- `run_id`, `session_id`, `aluno_id`, `coach_id`
- Intent bruto / intent classificado
- Tool calls (nome, args sanitizados, ok/erro, ms)
- Tokens in/out, provider, modelo, custo estimado
- Decisão de autonomia aplicada
- Erros e fallback determinístico

Dashboards mínimos: taxa de sucesso de tools, custo/dia, p95 latência, % intents resolvidos sem sair do Hoje.

---

## 17. Métricas

| Métrica | Definição | Alvo direccional |
|---------|-----------|------------------|
| Navegação | Ecrãs/toques por tarefa “próxima acção” | ↓ vs baseline |
| Resolução no intent | % UC-01 resolvidos sem mudar de tab | ↑ |
| Execução real | % dias com ≥1 `refeicao_conclusoes` | ↑ (substitui métrica localStorage) |
| Treinos | Sessões com `treino_sessoes` completed / semana | ↑ |
| Qualidade | % tool calls ok; % acções revertidas | ok ↑ / revert ↓ |
| Autonomia | % runs sem intervenção coach | Monitorar |
| Custo | Tokens / aluno / dia | Cap configurável |
| North Star as-built | Check-in 2 semanas | Manter |

Baseline: medir 2 semanas pós-1a (execução real) antes de julgar o agente.

---

## 18. Critérios de aceite (MVP Daily Agent)

1. Aluno autenticado com acesso válido vê intent bar no Hoje.
2. “O que faço agora?” devolve acção coerente com plano + conclusões do dia (não inventa dieta).
3. “Concluí” na refeição actual cria linha em `refeicao_conclusoes` e actualiza o contexto.
4. “Treino de hoje” reflecte agenda/`getAlunoHoje` (incluindo descanso).
5. “Restaurante” abre fluxo de foto (`MealPhotoLogSheet` ou equivalente) sem alterar o plano.
6. Tentativa de alterar dieta via NL é recusada (nível 4) com explicação.
7. Cada interação gera `agent_run` + tool calls auditáveis.
8. Aluno financeiramente/operacionalmente bloqueado não executa WRITE de plano.

---

## 19. Riscos

Ver auditoria §13. Produto: risco de chatbot genérico — mitigado pelo foco em execução. Dados: sem 1a, métricas mentem. Custo: quotas. UX: intent no Hoje, sem tab nova.

---

## 20. Fora de escopo (MVP)

- Reescrita do frontend ou do monólito completo
- Multi-agente paralelo
- Voz
- Vector knowledge base
- Coach Agent / carteira
- Alteração autónoma de dieta/treino
- Integrações wearables
- Substituição do chat humano coach↔aluno
- Supabase / mudança de stack

---

## Referências

- Arquitectura: [`docs/ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md)
- PRD as-built: [`2026-07-25-prd-blackhouse-recursos.md`](2026-07-25-prd-blackhouse-recursos.md)
- Auditoria: [`2026-07-26-auditoria-agentic-os.md`](2026-07-26-auditoria-agentic-os.md)
- Spec 1a: [`2026-07-26-spec-phase-1a-execucao-diaria.md`](2026-07-26-spec-phase-1a-execucao-diaria.md)
- Spec 1b: [`2026-07-26-spec-phase-1b-agent-foundation.md`](2026-07-26-spec-phase-1b-agent-foundation.md)
- Spec 2: [`2026-07-26-spec-phase-2-daily-agent.md`](2026-07-26-spec-phase-2-daily-agent.md)

---

*PRD complementar. Alterações de produto agentic: nova revisão datada em `docs/arquivo/`.*
