# Correção — análise da jornada do aluno mobile (2026-10-21)

## O que estava errado

Uma análise anterior (PR #12, branch `cursor/analise-jornada-aluno-mobile-0b29`) foi feita sobre o `main` do GitHub, que parou em **2026-01-13** (`964507b`) e ainda é a versão Lovable com Supabase. Produção não roda esse código.

Conclusões dessa análise que **não valem** para produção:

| Afirmação da análise antiga | Realidade em `melhoria-aluno` |
|---|---|
| App depende de Supabase (Auth, PostgREST, Realtime, Storage, Edge) | Sem Supabase em runtime; `src/lib/supabase.ts` é kill switch. API Express + Postgres + JWT `app_auth` |
| Precisa migrar para "Postgres VPS + API própria" | Já é assim. `api.blackhouse.app.br` → `server/index.js` (PM2 `blackhouse-api`) → `blackhouse_db` |
| Portal do aluno é shell desktop sem bottom nav | `StudentBottomNav` (Hoje, Dieta, Treino, Coach) + drawer "Menu" |
| Falta tela "Hoje" | `StudentTodayView` agent-first com Coleman |
| Falta modo sessão de treino | `StudentWorkoutSessionView` hidratada do servidor |
| Check-in é um formulário longo | Check-in por blocos com `CheckinStepHeader` e etapa na URL |
| Coleman precisa ser criado | Coleman existe (`components/student/agent/`, specs 2026-07-31 e 2026-08-11) |

O plano `2026-05-25-plano-melhoria-aluno.md` já cobria as mesmas fases.

## Verificação feita na VPS (somente leitura)

- Host `blackhouse-app.vps-kinghost.net`, repo `/root` com remote `romuloroldao/Black-House`.
- `HEAD` = `origin/melhoria-aluno` (`edeebf8`), 0 commits de diferença; nenhum arquivo rastreado alterado.
- Front publicado em `/var/www/blackhouse/dist` (build de 2026-10-09); `api.blackhouse.app.br/health` responde 200.
- `blackhouse_db` com schemas `app_auth` e `public` (85 tabelas).

## Risco de processo

`main` no GitHub está nove meses atrás de produção. Quem cria branch a partir de `main` (pessoas ou agentes) trabalha num app que não existe mais. Recomendação: promover `melhoria-aluno` para `main`, ou mudar o branch padrão do repositório.

## Gap real encontrado e corrigido

**Check-in perdia as respostas.** `StudentPortal` remonta a aba a cada troca (`key={activeTab}`) e o formulário vivia só em `useState`. Ir ao Hoje e voltar, ou recarregar, apagava tudo.

Correção: `src/lib/checkin-draft.ts` guarda respostas + peso em `localStorage`, por aluno e por semana (segunda a domingo, mesma regra do check-in). O rascunho é restaurado ao abrir e apagado após envio. Fotos não entram no rascunho (exigiria IndexedDB); o aluno é avisado.
