# QA e deploy — 2026-05-26

**Ambiente:** VPS produção (`blackhouse.app.br`)  
**Branches:** `melhoria-aluno` (19915ff), `lancamento` (fast-forward com #4)  
**Status validação:** **Concluída** (aceite 2026-05-26)

## Base de dados

- [x] Colunas `coach_respondido_em` / `coach_respondido_por` presentes em `weekly_checkins`
- [x] Índices `idx_weekly_checkins_pendentes_coach`, `idx_weekly_checkins_relato_trgm`
- [x] `npm run db:migrate` actualizado com patches `20260526` e `20260527` (idempotentes; owner da tabela é `postgres`)
- [x] Unificação aluno duplicado Luiz Fernando Macedo / import (1 registo + 1 dieta activa)

## Build e deploy

- [x] `npm run build` — OK
- [x] `npm run verify:api-contract` — OK
- [x] `rsync` → `/var/www/blackhouse/dist`
- [x] `pm2 restart blackhouse-api`

## Smoke API (sem token)

- [x] `GET /api/weekly-checkins/pendentes/count` → 401 (rota registada)

## Merges Git

- [x] PR #3 (`feat/import-contextual-p0` → `melhoria-aluno`) — merged
- [x] PR #4 (`melhoria-aluno` → `lancamento`) — merged

## Teste manual (coach/aluno) — concluído

| Área | Verificação | Resultado |
|------|-------------|-----------|
| Portal aluno | Hoje, nav, check-in 4 blocos, empty states | OK |
| Coach | Sidebar Check-ins, inbox (12 pendentes), busca | OK |
| Ficha aluno | Progresso → Check-ins \| Análise, Importar ficha | OK |
| Import / vínculo | Luiz único na lista, 1 dieta activa, email correcto | OK |
| Checklist aluno | `2026-05-25-checklist-teste-aluno.md` | Todos os itens marcados |

**Sessão de teste:** painel coach (Romulo) + portal aluno em `blackhouse.app.br`, pós-deploy 2026-05-26.

## Próximo foco (pós-validação)

- Import **P1** (substituir dieta, `data_retorno`, wizard)
- Check-in **Sprint 4+** (IA, PDF, inbox por equipa)
- Polish portal pós-MVP (histórico cargas, macros plano activo)
