# Spec Phase 2 — Daily Agent MVP

| Campo | Valor |
|-------|--------|
| **Fase** | 2 — Daily Agent |
| **Data** | 2026-07-26 |
| **Dependências** | Phase 1a (execução) + Phase 1b (foundation) |
| **PRD** | [`2026-07-26-prd-blackhouse-agentic-os.md`](2026-07-26-prd-blackhouse-agentic-os.md) DA-01…DA-06, UC-01…UC-06 |
| **Surface** | Intent bar no ecrã **Hoje** + bottom sheet (sem tab nova) |

**Hipótese a validar:** o aluno executa o plano com menos navegação e mais orientação contextual.

---

## 1. Experiência do utilizador

### 1.1 Onde vive

- Tab **Hoje** (`StudentTodayView`)
- Barra fixa ou sticky no topo/fundo do conteúdo: placeholder “O que queres fazer agora?”
- Toque abre **bottom sheet** com:
  - input de texto
  - chips de atalho (O que faço agora · Próxima refeição · Treino · Concluí · Restaurante)
  - thread curta da sessão do dia
  - **action cards** renderizados a partir da resposta do agente

### 1.2 Princípios de UI

- Não é um chat genérico full-screen.
- Cards têm no máximo uma CTA primária e uma secundária.
- Deep-links reutilizam ecrãs existentes (Dieta, Sessão treino, MealPhoto, Check-in).
- pt-BR; tom directo e operacional (“Próximo: Almoço — frango e arroz”).
- Respeitar overlay lock / bottom nav do portal.

### 1.3 Componentes sugeridos

| Componente | Path sugerido |
|------------|---------------|
| `StudentIntentBar` | `src/components/student/agent/StudentIntentBar.tsx` |
| `StudentAgentSheet` | `src/components/student/agent/StudentAgentSheet.tsx` |
| `AgentActionCard` | `src/components/student/agent/AgentActionCard.tsx` |
| `useStudentAgent` | `src/hooks/useStudentAgent.ts` |

Estados: idle, sending, streaming/typing, error, blocked_access.

---

## 2. Intents e comportamento

| ID | Utterance / chip | Intent classificado | Comportamento |
|----|------------------|---------------------|---------------|
| UC-01 | “O que faço agora?” | `next_action` | `get_next_action` → texto + card CTA |
| UC-02 | “Qual minha próxima refeição?” | `next_meal` | Detalhe da refeição não concluída + card Concluir / Ver dieta |
| UC-03 | “Qual meu treino de hoje?” | `today_workout` | Nome/descanso + card Iniciar sessão / Ver treinos |
| UC-04 | “Concluí.” | `complete` | Completa a acção actual (refeição ou exercício conforme contexto) |
| UC-05 | “Estou atrasado.” | `late` | Recomputa próxima acção; copy empática; sem inventar plano |
| UC-06 | “Estou num restaurante.” | `restaurant` | Card abrir foto refeição livre; opcional dica educativa se `refeicao_livre_content_id` |

### 2.1 Matriz de cards

| Situação | Card title (ex.) | Primary | Secondary |
|----------|------------------|---------|-----------|
| Próxima refeição | Nome da refeição | `complete_meal` “Concluí” | `open_ui` tab dieta / meal sheet |
| Treino pendente | Nome do treino | `open_ui` sessão | `open_ui` lista treinos |
| Descanso | “Descanso hoje” | — | Ver agenda |
| Check-in due | “Check-in semanal” | `open_ui` checkin | — |
| Restaurante | “Registar refeição livre” | `open_ui` meal photo | — |
| Bloqueado | “Acesso pendente / pagamento” | `open_ui` blocked | — |
| Plano em dia | “Estás em dia” | — | — |

### 2.2 Deep-links `open_ui`

| `target` | Comportamento |
|----------|---------------|
| `hoje` | Fecha sheet |
| `dieta` | Tab dieta (+ opcional `meal_key`) |
| `treino` | Tab treinos |
| `treino_sessao` | Abre `StudentWorkoutSessionView` do treino do dia |
| `meal_photo` | Abre `MealPhotoLogSheet` |
| `checkin` | Tab check-in |
| `coach_chat` | Tab coach |
| `blocked_financial` | `/portal-aluno/blocked` |
| `blocked_operational` | `/portal-aluno/access-blocked` |

Args tipados no Zod da tool `open_ui`.

---

## 3. Fluxos detalhados

### 3.1 UC-01 — O que faço agora?

```text
Chip/texto → POST /api/agent/sessions/:id/messages
  → fast path ou LLM
  → get_next_action (+ get_meal_detail se meal)
  → assistant_text + AgentActionCard
```

Aceite: resposta coerente com `execucao` do dia; se refeição já concluída, não a sugere como próxima.

### 3.2 UC-04 — Concluí

```text
Se proxima_acao.type == next_meal
  → complete_meal(meal_key, plano, dieta_id)
  → refresh context
  → “Registado. Próximo: …”
Se proxima_acao.type == today_workout e sessão em curso
  → orientar log_workout_set / complete exercício via card (não adivinhar carga)
Senão
  → pedir clarificação com chips (Refeição · Treino)
```

Aceite: linha em `refeicao_conclusoes` ou série/sessão actualizada; UI Hoje reflecte após refresh.

### 3.3 UC-06 — Restaurante

```text
→ intent restaurant
→ NÃO altera dieta
→ card open_ui meal_photo
→ copy: alinhar escolha ao plano; usar foto para estimar
```

Aceite: abre fluxo existente de foto; análise continua human-in-the-loop (revisão antes de guardar) como hoje.

### 3.4 Recusa HIGH IMPACT

```text
User: "Muda minha dieta para low carb"
→ intent refuse / decision refuse_high_impact
→ texto: só o coach altera o plano; oferecer open_ui coach_chat (draft nível 3 opcional)
→ zero WRITE em dietas
```

---

## 4. Integração com foundation

| Concern | Uso |
|---------|-----|
| Sessão | Uma `agent_sessions` open por aluno/dia/channel `student_hoje` |
| Mensagens | User + assistant (+ tool role interno não mostrado) |
| Fast path | Chips e frases curtas sem LLM |
| LLM | Frases ambíguas; sempre com context allowlist |
| Autonomia | Max 2 no MVP; draft mensagem = 3 com approval UI simples no card |

### 4.1 Approval UX (nível 3) — mínimo

Se o agente propor `draft_message_to_coach`:

1. Card mostra rascunho.
2. Botões Enviar / Descartar.
3. Enviar → `POST /api/agent/approvals/:id/decide` approved → só então cria mensagem no chat real.
4. Descartar → rejected.

Fora do MVP: envio autónomo.

---

## 5. Estados de erro e fallback

| Caso | UX |
|------|-----|
| API offline | Toast + manter chips que só navegam (`open_ui` local) |
| LLM timeout | Fallback `get_next_action` determinístico |
| Tool fail | Mensagem honesta; não marcar conclusão |
| Rate limit | “Atingiste o limite; usa os atalhos do Hoje” |
| Sem dieta/treino | Orientar contactar coach / ver portal |

---

## 6. Analytics / métricas do MVP

Instrumentar eventos (metadata em `agent_runs` ou analytics existente):

- `agent_intent_submitted` { intent_classified, used_llm }
- `agent_card_cta_clicked` { card_id, action }
- `agent_task_completed_via_agent` { type: meal|workout }
- `agent_navigation_avoided` (proxy: CTA complete sem mudança de tab)

Comparar vs baseline pós-1a: toques médios para “marcar refeição” / “abrir treino do dia”.

---

## 7. Critérios de aceite (checklist QA)

| # | Critério | Pass |
|---|----------|------|
| 1 | Intent bar visível no Hoje para aluno com acesso | ☐ |
| 2 | Chip “O que faço agora?” devolve card accionável | ☐ |
| 3 | “Próxima refeição” ignora refeições já concluídas hoje | ☐ |
| 4 | “Concluí” persiste em PG e actualiza UI | ☐ |
| 5 | “Treino de hoje” reflecte agenda (incl. descanso) | ☐ |
| 6 | “Restaurante” abre foto; não altera `dietas` | ☐ |
| 7 | Pedido para alterar plano é recusado | ☐ |
| 8 | Aluno bloqueado: só cards de desbloqueio; sem WRITE execução | ☐ |
| 9 | `agent_run` + `agent_tool_calls` existem por interação | ☐ |
| 10 | Funciona em viewport mobile (bottom sheet + teclado) | ☐ |
| 11 | Sem regressão: tabs Dieta/Treino/Check-in manuais | ☐ |
| 12 | Contrato API actualizado; `verify:api-contract` ok | ☐ |

---

## 8. Plano de testes

| Tipo | Casos |
|------|-------|
| Unit | Classificador fast path; map intent→tools |
| Integration | messages → complete_meal → GET conclusoes |
| E2E Playwright | Aluno mobile: Hoje → chip → concluir refeição |
| Manual | Restaurante, bloqueio financeiro, frase ambígua |

---

## 9. Rollout

1. Feature flag `VITE_AGENT_DAILY_ENABLED` + env server `AGENT_DAILY_ENABLED`.
2. Soft launch: coaches internos / alunos piloto.
3. Monitorar custo tokens, taxa tool ok, reclamações.
4. Só então default on.

---

## 10. Fora de escopo (Phase 2)

- Guided workout série-a-série completo (Phase 3 — pode reutilizar cards)
- Substituição persistida / shopping list (Phase 4)
- Proactividade push (“já são 13h…”) (Phase 5)
- Coach Agent (Phase 7)
- Voz, widgets OS, multi-agente
- Redesign do portal

---

## 11. Sequência de implementação

1. Hook `useStudentAgent` + API client methods
2. `StudentIntentBar` + sheet + `AgentActionCard`
3. Wire chips → fast path intents
4. Wire “Concluí” + refresh `useAlunoHoje`
5. Restaurante → meal photo
6. Recusa HIGH IMPACT + blocked states
7. Feature flag + e2e + métricas
8. Soft launch

---

*Spec Phase 2 — Daily Agent MVP. Implementação após 1a e 1b.*
