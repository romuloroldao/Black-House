# Pesquisa web + receitas personalizadas (2026-07-26)

Princípio: **A Black House define os limites. A web amplia as possibilidades. O agente adapta.**

## 1. Auditoria da arquitectura actual

| Peça | Estado |
|------|--------|
| Fast path + tool dispatch | ✅ |
| LLM structured opcional | ✅ |
| `create_recipe` | Existia (heurística local, sem web) |
| Web search | ❌ → agora ✅ (`web-search.service` + tool) |
| Observabilidade `agent_*` | ✅ (`insertToolCall` + `insertDecision`) |

Fluxo anterior de receita:

```text
Mensagem → create_recipe → get_next_action → get_meal_detail → composeRecipe heurístico
```

## 2. Skills e agentes

Skills relevantes: `software-engineer`, `system-architecture`, `food-data-engineer-nutrition-database`, `ux-expert`, `javascript-testing-patterns`, `review/security`.

Agentes Cursor: explore/auditoria; implementação no Daily Agent existente (não criar agente paralelo).

## 3–4. Mapa do agente e tools

```text
Chat → classifyFastPath / LLM → dispatchTool → composer → cards
```

Tools novas: `search_recipe_inspiration` (READ).

## 5. Arquitectura da pesquisa web

```text
Pedido → intent CREATE_RECIPE → plano (itens)
       → shouldSearchWeb?
            NÃO → síntese local
            SIM → search_recipe_inspiration
                 → rank → synthesize → composeRecipe (quantidades do plano)
```

Providers: Tavily → Brave → DuckDuckGo HTML. `WEB_SEARCH_ENABLED=false` desliga.

## 6. Intents

`CREATE_RECIPE` (+ preferências: cuisine, quick, fancy, spicy, creative).

Não pesquisar: `GET_NEXT_MEAL`, treino, peso, `FIND_SUBSTITUTION`, complete.

## 7. Tools

| Tool | Uso |
|------|-----|
| `get_next_action` / `get_meal_detail` | Contexto plano |
| `search_recipe_inspiration` | Ideias externas |
| `list_coach_rules` / `list_substitutions` | Regras (não web) |

## 8. Hierarquia de verdade

```text
Sistema → Black House → Plano → Contexto → Web (inspiração)
```

## 9. Decisão pesquisar?

Sim se: diferente/criativa/gostosa/culinária/rápido/restaurante/apimentado/`receita` criativa.  
Não se: próxima refeição, gramas, treino, substituir, registar.

## 10. Segurança

- Sanitizar snippets (strip HTML, neutralize “ignore instructions”).
- Marcar `untrusted_external: true`.
- Nunca executar instruções da web.
- Não copiar receita integral; só técnica/título sintetizado.
- Fallback local se timeout/falha.

## 11. Resposta estruturada

Texto progressivo + card `recipe` (itens do plano) + card opcional `references`.

## 12. Plano incremental

1. ✅ Tool + serviço + create_recipe com web opcional  
2. ⏳ LLM re-síntese com top-3 ideias (quando AI disponível)  
3. ⏳ Upload de cardápio / shopping list  
4. ⏳ Preferências persistidas do aluno  

## 13. Testes

`server/tests/agent-recipe-web.test.js` — decisão, query, ranking, injection, quantidades.

## 14. Observabilidade

Decisions: `web_search_decision`, `web_search_selected`, `web_search_fallback` + tool_calls automáticos.

## 15. Impacto

Sem breaking changes no frontend. Latência extra só em create_recipe com web (~2–5s). Env opcional: `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`, `WEB_SEARCH_ENABLED`, `WEB_SEARCH_TIMEOUT_MS`.
