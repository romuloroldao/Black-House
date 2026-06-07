# Rotação com múltiplos cardápios (A, B, C…)

**Data:** 2026-05-27

## Modelo

- Coluna `dietas.rotacao_sequencia` (JSONB): `[{ "plano": "A", "dias": 3 }, { "plano": "B", "dias": 1 }, { "plano": "C", "dias": 2 }]`
- Campos legados `rotacao_dias_plano_a/b` mantidos para compatibilidade; preenchidos automaticamente a partir de A e B na sequência.
- Motor: `src/lib/diet-rotation.ts` e `server/utils/diet-rotation.js` (`normalizeRotationBlocks`).

## UI

- **Coach:** `DietRotationFields` — lista de blocos (cardápio + dias), adicionar/remover, pré-visualização da sequência.
- **Aluno:** tabs dinâmicos por cardápio quando não há rotação automática; com rotação, plano do dia via `getRotationForDate`.
- **Detalhe da refeição:** um bloco por cardápio presente na refeição (A, B, C…).

## Import PDF

- Parser marca `plano: 'A'|'B'|'C'…` por volta de “Refeição 1”.
- Reimport: `inferRotationBlocksFromPlanos` — 2 planos → 3A·1B (ajustável); 3+ planos → 1 dia por cardápio na sequência (ajustável no coach).

## Migração

`server/migrations/20260527_rotacao_sequencia.sql` — backfill A/B a partir dos campos antigos.
