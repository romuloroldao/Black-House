# Migração de Precisão Nutricional

Data: 2026-05-15

## Contexto

Foi adicionada uma migração incremental para suportar cálculos nutricionais mais consistentes sem reexecutar o schema completo.

Arquivos envolvidos:

- `server/migrations/20260216_nutrition_precision_patch.sql`
- `server/scripts/applyNutritionPatch.js`
- `package.json` (`npm run db:migrate`)

## O Que A Migração Altera

- Adiciona `public.alimentos.alcool_por_referencia`, usado no cálculo energético com 7 kcal/g.
- Adiciona `public.itens_dieta.unidade_quantidade`, com valores permitidos `g`, `ml` e `un`.
- Recria o `CHECK` de `unidade_quantidade` para garantir valores canónicos.

## Como Aplicar

Pela raiz do projeto:

```bash
cd /root && npm run db:migrate
```

O comando usa as credenciais `DB_*` de `server/.env`.

## Atenção A Permissões

No ambiente atual, a execução com o utilizador configurado em `server/.env` falhou com:

```text
must be owner of table alimentos
```

Isto indica que o utilizador da aplicação consegue operar a API, mas não tem permissão para executar `ALTER TABLE` nas tabelas existentes.

Para aplicar em produção, usar um utilizador PostgreSQL que seja owner das tabelas `public.alimentos` e `public.itens_dieta`, ou um superuser:

```bash
psql "postgresql://OWNER:PASSWORD@HOST:PORT/DBNAME" -f /root/server/migrations/20260216_nutrition_precision_patch.sql
```

## Estado Esperado Após Aplicar

Depois da migração:

- `POST /api/alimentos` e `PATCH /api/alimentos/:id` conseguem gravar `alcool_por_referencia`.
- Itens de dieta passam a aceitar e devolver `unidade_quantidade`.
- Totais nutricionais no frontend usam `g`, `ml` ou `un` de forma explícita.

