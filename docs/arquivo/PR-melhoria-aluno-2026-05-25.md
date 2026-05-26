# PR: melhoria-aluno → lancamento

**Título:** feat(aluno): portal do aluno, check-ins coach e polish  
**PR:** [#4](https://github.com/romuloroldao/Black-House/pull/4) — **merged**  
**Validação:** concluída 2026-05-26 (`docs/arquivo/2026-05-26-qa-deploy-checkin-aluno.md`)

## Summary

- **Ecrã Hoje** como home do portal: treino, dieta, pendências, countdown de retorno, card «Foto desta semana» e API agregada `GET /api/alunos/me/hoje`.
- **Fotos de evolução**: redesign (tab Fotos por defeito, deep link `upload=1`, onboarding, menu «Fotos e métricas»), upload mobile com compressão e pendência semanal na API.
- **Experiência aluno**: bottom nav mobile, hub Coach, check-in em 4 blocos com streak, sessão de treino na academia, dieta timeline + ciclo rotativo Plano A/B, scrollbars e empty states.
- **Coach / plataforma**: modais de confirmação para exclusões (`ConfirmContext`), correção de avisos em massa (duplicação e contagem no toast), inferência de rotação na importação de dietas.
- **Check-ins coach**: inbox no sidebar (badge pendentes), timeline + drawer na ficha (sub-abas Check-ins | Análise), estado respondido no backend e feedback visível no portal do aluno.

## Test plan

- [x] Login como aluno → landing em **Hoje**; bottom nav (Hoje, Dieta, Treino, Coach) e menu **Mais → Fotos e métricas**
- [x] Card **Foto desta semana** → **Tirar foto** abre upload; após envio, card mostra estado «enviada esta semana»
- [x] `?tab=progress&upload=1` abre diálogo de foto; tab **Fotos** por defeito sem fotos
- [x] Check-in semanal (4 blocos) e streak no Hoje / Métricas
- [x] Dieta: Plano A/B, checklist refeições, scroll em lista e detalhe
- [x] Treino: iniciar sessão a partir do Hoje; timer de descanso
- [x] Coach: chat e avisos; envio de aviso em massa sem duplicar notificações
- [x] Coach: sidebar **Check-ins**; inbox com filtros; ficha aluno → Progresso → **Check-ins**; salvar resposta e marcar respondido
- [x] Aluno: ver feedback do coach no check-in após resposta
- [x] Ações destrutivas (excluir foto, aluno, etc.) pedem confirmação em modal
- [x] Regressão login coach/admin e rotas principais
