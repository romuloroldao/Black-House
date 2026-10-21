# Fix: erro ao salvar edição de alimento (catálogo)

**Data:** 2026-07-21  
**Sintoma:** PATCH `/api/food-catalog/:id` → HTTP 500 ao guardar (ex.: Abacate / Abacaxi).

## Causa

A migração `server/migrations/20260708_food_catalog.sql` ficou **parcial**:

- Colunas novas em `public.alimentos` (`versao_actual`, `nome_normalizado`, etc.) já existiam.
- Tabelas `alimento_versoes`, `alimento_audit_log`, `alimento_aliases` **não** existiam.
- Colunas de snapshot em `itens_dieta` também em falta.

O `FoodCatalogService.update` grava versão + auditoria numa transação → falhava ao `INSERT` em `alimento_versoes`.

Nota: um OPTIONS no Abacate às 13:24 devolveu 502 por restart PM2 (SMTP); o 500 real foi no PATCH (ex. Abacaxi `fd3b9283-…` às 13:25).

## Correção aplicada (produção)

1. Criadas as 3 tabelas + índices.
2. Colunas de snapshot em `itens_dieta` + trigger `trg_itens_dieta_fill_snapshot`.
3. Backfill: 377 versões iniciais; 1064 itens de dieta com snapshot.
4. `GRANT` para o user da API.
5. Backfill de `criado_por` com cast seguro de `autor` (text legado com valores não-UUID) — mesmo ajuste no ficheiro da migração.

## Como validar

1. Abrir catálogo → editar Abacate → guardar (com motivo se alterar macros).
2. Confirmar HTTP 200 e `versao_actual` a incrementar em `alimentos`.
