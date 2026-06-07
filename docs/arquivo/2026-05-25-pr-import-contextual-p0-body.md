## Summary

Redesenha a importação de fichas/dietas para reduzir erros de vínculo e retrabalho do coach:

- **Modo `enrich`**: importar dieta/protocolo dentro do perfil do aluno (`POST /api/import/confirm-diet`)
- **Destino explícito** na lista: criar novo aluno ou escolher aluno existente
- **Detecção de duplicados** (email, CPF, nome) antes de criar novo registo
- **CTA Vincular Usuários** abre Gestão de Alunos com modal (`?tab=students&import=1`)

Especificação: `docs/arquivo/2026-05-25-especificacao-importacao-contextual-p0.md`

## Commits (ordem de review)

1. `feat(import): expor confirm-diet no contrato e api-client`
2. `feat(import): modos create/enrich no StudentImporter`
3. `feat(import): entry points no perfil e na lista de alunos`
4. `fix(linking): CTA importar fichas e spec P0`

## Test plan

- [ ] Perfil `/alunos/:id` → Importar ficha → dieta vinculada ao aluno
- [ ] Lista → Importar → «Aluno existente» → não cria duplicado
- [ ] Lista → import com email/nome igual → alerta de duplicado
- [ ] Vincular Usuários → Importar fichas → abre modal na Gestão de Alunos
- [ ] `npm run build` sem erros

## Notas

- Reimportação **adiciona** nova dieta (não substitui a activa) — P1.
- `data_retorno` fora do schema `confirm-diet` — P1.
