# Equivalência alimentar isocalórica (logicaTabela)

## Regra de negócio

1. Substituição **apenas no mesmo grupo** (`tipos_alimentos.nome_tipo` = aba da planilha).
2. Equivalência **isocalórica**: `Q_sub = (Q_ref × Kcal_ref) / Kcal_sub` (base 100 g).
3. **Vegetais A (livres)**: sem substituição por kcal (`equiv_livre` / kcal = 0).

## Código

| Camada | Ficheiro |
|--------|----------|
| Motor servidor | `server/utils/food-equivalence.js` |
| API | `GET /api/alimentos/grupos-equivalencia`, `GET /api/alimentos/:id/substituicoes` |
| Motor frontend | `src/lib/foodEquivalence.ts` |
| UI substituição | `src/components/nutrition/FoodSubstitutionDialog.tsx` |

## Base de dados

- Migração: `server/migrations/20260519_equivalencia_alimentar_grupos.sql`
- Seed planilha: `npm run db:seed-equivalencia` (lê `logicaTabela/Equivalencia_Alimentar.xlsx`)
- Patches: `npm run db:migrate` (inclui migração de grupos; requer owner da BD para ALTER)

## Grupos (18)

Carnes e Proteínas, Cereais/Raízes/Tubérculos/Frutos, Feijão e Leguminosas, Fibras A/B, Frutas, Frutas Oleosas, Leite e Derivados, Livre, Oleaginosas, Óleos e Gorduras, Pães, Personalizado CARB/LIP/PROT, Sucos, Vegetais A/B.
