# Daily Agent — Food Replacement Capability

Data: 2026-07-30

## Resumo

O assistente existente (Daily Agent) passa a calcular e apresentar equivalentes isocalóricos no chat quando a intenção é substituição alimentar — sem criar um assistente paralelo.

## Activação

Fast path `mode === 'substitution'` em `server/services/agent/orchestrator.js` (`classifyFastPath`):

- Triggers clássicos: substituir, trocar alimento, equivalen, em vez de
- Domínio alimentar: não tenho, sem [alimento], trocar X por Y, não quero comer, substituir.*refeição
- Não captura treino / progresso / peso numérico

## Pipeline

1. `get_next_action({ prefer: 'meal' })` + `get_meal_detail` (plano do dia + overrides `refeicao_substituicoes`)
2. Parse NL (`food-replacement.js`) → origem(ns) / destino
3. Match fuzzy nos itens da refeição; se ambíguo, pergunta
4. `list_substitutions` (mesmo grupo + kcal) via `food-equivalence.js`
5. `composeFoodReplacement` → texto com quantidades + cards `apply_substitution`
6. Frontend: `useStudentAgent.runCardAction` → `putRefeicaoSubstituicaoSafe`

## Tools

| Tool | Papel |
|------|--------|
| `search_food` | READ — mapeia nome → UUID no catálogo |
| `get_meal_detail` | READ — itens filtrados por plano + merge do dia |
| `list_substitutions` | READ — opções isocalóricas |
| `apply_substitution` | WRITE_LOW — override só hoje |
| `clear_substitution` | WRITE_LOW — repor original |

## Fora de âmbito

- `modify_diet` / alterar plano do coach
- Motor multi-macro novo (só apresenta macros já no catálogo)
- Substituir UI `FoodSubstitutionDialog` / `StudentDietView`

## Testes

`server/tests/agent-food-replacement.test.js` + `server/tests/dieta-substituicoes.test.js`
