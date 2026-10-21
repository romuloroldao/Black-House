# Cardápios Plano A / B — não mesclar

**Data:** 2026-05-26  
**Regra de produto:** fichas com dois cardápios (rotação A/B) **nunca** devem ser apresentadas ou somadas como um único plano.

## Persistência (import)

- Cada refeição/alimento grava-se com `refeicao` distinta, ex.: `Almoço (Plano A)` vs `Almoço (Plano B)` (`server/services/diet.service.js` → `_buildRefeicaoLabel`).
- Campos de rotação na dieta: `rotacao_ativa`, `rotacao_dias_plano_a/b`, `rotacao_plano_inicial`, `rotacao_data_inicio`.

## Leitura no frontend

| Ecrã | Comportamento |
|------|----------------|
| **Portal aluno** (`StudentDietView`) | `buildMealGroups` separa itens em `itemsByPlano.A` / `.B`; `getItemsForPlano` devolve só o plano activo; rotação define o plano do dia via `getRotationForDate`. |
| **Import** (`StudentImporter`) | Soma de macros por refeição usa `sumImportDeclaredMacros` — só um plano de cada vez. |
| **Coach** (`DietViewer`) | Toggle Plano A/B no resumo; totais com `filterItensForPlanoView`. |

## Parser canónico

`parseRefeicaoLabel` em `src/lib/diet-student-utils.ts` reconhece:

- `Café da Manhã - Plano A`
- `Almoço (Plano A)` e `Almoço (Plano A • 12:00)` (formato do import)
- Campo `refeicao.plano` = `A` ou `B` no import

Quando existem A **e** B, `dietHasPlanoAB` / `hasPlanoAB` fica `true` e a UI **não** mistura listas nem macros.

## O que não fazer

- Somar macros de todas as refeições sem filtrar plano.
- Mostrar itens A e B na mesma lista sem toggle/rotação.
- Unificar refeições duplicadas só pelo nome base ignorando o sufixo de plano.
