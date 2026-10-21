# PR: feat(coach) — inbox, timeline e resposta a check-ins semanais

**Base:** `melhoria-aluno` (branch actual)  
**Título sugerido:** feat(coach): inbox de check-ins, timeline na ficha e estado respondido

## Summary

- **Inbox global** no menu lateral (tab Check-ins) com filtros, pesquisa no relato, badge de pendentes e drawer de detalhe reutilizado.
- **Ficha do aluno → Progresso:** sub-abas Check-ins | Análise (`StudentProgressCoachTabs`), timeline cronológica, delta vs semana anterior e resposta inline + deep link para chat.
- **Backend:** colunas `coach_respondido_em` / `coach_respondido_por`, endpoint de contagem de pendentes, marcação respondido, migração de índice para pesquisa no relato; notificações ao aluno quando o coach responde.
- **Portal aluno:** feedback do coach visível no check-in (`StudentCoachCheckinFeedback`).

## Test plan

- [ ] Login coach → sidebar **Check-ins** com badge (se houver pendentes)
- [ ] Inbox: filtrar por aluno/estado; pesquisa no relato; abrir drawer; marcar respondido
- [ ] Ficha aluno → **Progresso** → sub-aba **Check-ins** (default); navegar ◀ ▶ no drawer; salvar resposta
- [ ] **Abrir chat** no drawer leva a Mensagens com o aluno correcto
- [ ] Login aluno → check-in semanal; após resposta do coach, ver feedback no formulário/histórico
- [ ] `npm run db:migrate` em ambiente com BD limpa ou staging
- [ ] Regressão: notificações, avisos, import (se branch merged)

## Migrações

- `server/migrations/20260526_checkin_coach_respondido.sql`
- `server/migrations/20260527_checkin_relato_search.sql`
