# Checklist — teste manual portal do aluno

**Data:** 2026-05-25  
**Validação concluída:** 2026-05-26 (aceite pelo produto)  
**Branch:** `lancamento` (via `melhoria-aluno` → PR #4)  
**URL:** https://blackhouse.app.br/portal-aluno  

## Pré-requisitos

- [x] Conta aluno vinculada (Romulo + cenário Luiz Fernando Macedo unificado)
- [x] Hard refresh (Ctrl+Shift+R) após deploy
- [x] Testar em telemóvel e desktop *(desktop validado em 2026-05-26; mobile aceite operacional)*

## Fase 0–1 — Hoje e navegação

- [x] Login cai em `?tab=hoje`
- [x] Hero mostra nome e pendências reais (sem % inventados)
- [x] Countdown de retorno aparece quando há `data_retorno`
- [x] Bottom nav: Hoje, Dieta, Treino, Coach (alvos fáceis de tocar)
- [x] Menu “Mais” no mobile abre itens secundários

## Dieta

- [x] Timeline de refeições com scroll fluido
- [x] Plano A/B quando aplicável
- [x] Checklist de refeição persiste após refresh
- [x] Macros do plano activo coerentes com itens

## Treino

- [x] “Iniciar sessão” no Hoje e na tab Treino
- [x] Modo sessão fullscreen, timer, sair sem travar scroll
- [x] Lista/PDF ainda acessíveis

## Check-in e progresso

- [x] Check-in em 4 blocos com Próximo/Anterior
- [x] Streak no Hoje e em Progresso
- [x] Envio com toast de sucesso

## Fase 4 — Polish

- [x] Onboarding 3 passos no primeiro acesso (ou após limpar `bh-student-onboarding-v1`)
- [x] Empty states com ícone e CTA onde não há dieta/treino
- [x] Notificações com etiqueta Coach / Sistema / Retorno
- [x] `prefers-reduced-motion`: sem animações longas

## Registo de feedback

| Aluno/Coach | Dispositivo | Problema | Severidade |
|-------------|-------------|----------|------------|
| — | — | Nenhum bloqueante reportado na validação 2026-05-26 | — |

**Referência:** `docs/arquivo/2026-05-26-qa-deploy-checkin-aluno.md`
