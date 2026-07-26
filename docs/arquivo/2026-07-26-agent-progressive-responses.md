# Respostas progressivas — Agent-First (2026-07-26)

Princípio: **Responder primeiro. Redirecionar depois.**

## 1. Diagnóstico da experiência actual (pré-mudança)

| Área | Estado |
|------|--------|
| Agent Home (`hoje`) | Chat dominante + strip de contexto |
| Fast paths | Refeição/treino/peso/atrasado/restaurante |
| `composeMeal` | Nomeava a refeição **sem listar itens** → empurrava para dieta |
| `open_progress` / substituição | Auto `open_ui` sem prévia suficiente |
| Receita / reorganizar dia | Não existiam |
| Cards UI | Título + body + 2 botões (sem `items[]`) |

## 2. Problemas de hierarquia

1. Navegação tratada como resposta (Tipo 1 deveria ser chat-only).
2. Prévia insuficiente (só o nome da refeição).
3. Intenção de transformação (receita) ausente.
4. Redirect automático em evolução/substituição.

## 3. Mapa agent-first

```text
INTENÇÃO → CONTEXTO (tools) → RESPOSTA no chat → AÇÃO opcional → DETALHE/UI só se pedir
```

Navegação tradicional permanece na sidebar/bottom nav e em CTAs «Ver mais».

## 4. Modelo de respostas progressivas

| Tipo | Exemplo | Formato |
|------|---------|---------|
| 1 Directa | Próxima refeição | Título + bullets de itens + CTAs |
| 2 Acção | Concluí / iniciar treino | Confirmação + próxima acção |
| 3 Prévia | Evolução / aderência | Resumo + «Ver completo» |
| 4 Transformação | Receita com ingredientes | Criar no chat preservando quantidades |

## 5. Contrato estruturado (card)

```json
{
  "type": "meal_preview",
  "title": "Refeição 4",
  "body": "• 180 g de Arroz\n…",
  "items": [{ "name": "Arroz", "quantity": "180 g" }],
  "primary_action": { "type": "tool", "name": "complete_meal", "args": {} },
  "secondary_action": { "type": "open_ui", "name": "open_ui", "args": { "target": "dieta" } }
}
```

Frontend: `AgentActionCard` renderiza `items[]` quando presente.

## 6. Catálogo de intents (fast path)

| Intent | Mode |
|--------|------|
| GET_NEXT_MEAL | `next_meal` |
| GET_TODAY_WORKOUT | `workout_day` / `next_workout` |
| COMPLETE_MEAL | `complete` |
| START_WORKOUT | `start_workout` |
| GET_PROGRESS | `open_progress` / `behavioral` |
| CREATE_RECIPE | `create_recipe` |
| FIND_SUBSTITUTION | `substitution` |
| ANALYZE_MENU | `restaurant` |
| REORGANIZE_DAY | `reorganize_day` / `late` |
| LOG_WEIGHT | `log_weight` / `ask_weight` |

## 7. Catálogo de tools (relevantes)

- `get_next_action`, `get_meal_detail` (agora com `alimento.nome`)
- `get_today_workout`, `get_next_workout`, `get_week_agenda`
- `get_behavioral_insight`, `complete_meal`, `log_body_weight`, `open_ui`
- `list_substitutions`

## 8. Navegação contextual

Redirecionar quando: informação extensa, UI especializada (foto, sessão guiada, check-in), ou pedido explícito de detalhe.  
Não redirecionar para obter o nome/itens da próxima refeição.

## 9. Plano incremental

1. ✅ Prévia de refeição com itens + cards `meal_preview`
2. ✅ `CREATE_RECIPE` / `REORGANIZE_DAY`
3. ✅ Evolução e substituição sem auto-navigate cego
4. ⏳ Prévia de treino com 1.º exercício + última carga
5. ⏳ Shopping list / análise de cardápio com upload
6. ⏳ Memória de thread para «quero uma receita» após prévia

## 10. Plano de testes

- Unit: `server/tests/agent-organic-responses.test.js` (compose + intents)
- Manual: «Qual é a minha próxima refeição?» → bullets no chat; «Me dê uma receita…» → modo de preparo; botão «Ver mais detalhes» opcional

## Critério de sucesso

Aluno chega à **resposta antes da tela**.
