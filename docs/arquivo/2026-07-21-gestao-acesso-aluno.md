# Gestão de acesso operacional do aluno

**Data:** 2026-07-21

## Modelo

Campo em `public.alunos` (independente de `student_access_state`):

- `acesso_operacional`: `pending` | `active` | `suspended` | `revoked`
- `acesso_operacional_em`, `acesso_operacional_por`, `acesso_operacional_nota`

Acesso efectivo ao portal = email confirmado + vínculo + `active` + financeiro não bloqueado.

## APIs

- `PATCH /api/alunos/:alunoId/acesso` — coach (próprios) / admin
- `GET /api/alunos/by-coach` — inclui campos de acesso + `financial_access_status`
- `GET /auth/user` e `GET /api/me` — expõem `acesso_operacional` e `access_block_reason`
- Middleware `resolveAlunoOrFail` bloqueia operacional; `checkPayment` em `me/hoje` e `PATCH me`

## UI

- Lista de alunos: badge + menu Conceder/Suspender/Revogar/Reactivar
- Card na ficha: mesmo eixo + aviso de preservação de dados
- Aluno: `/portal-aluno/access-blocked` (operacional) vs `/portal-aluno/blocked` (financeiro)
