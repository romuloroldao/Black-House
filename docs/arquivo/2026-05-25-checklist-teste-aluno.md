# Checklist — teste manual portal do aluno

**Data:** 2026-05-25  
**Branch:** `melhoria-aluno`  
**URL:** https://blackhouse.app.br/portal-aluno  

## Pré-requisitos

- [ ] Conta aluno vinculada (ex.: Romulo)
- [ ] Hard refresh (Ctrl+Shift+R) após deploy
- [ ] Testar em telemóvel e desktop

## Fase 0–1 — Hoje e navegação

- [ ] Login cai em `?tab=hoje`
- [ ] Hero mostra nome e pendências reais (sem % inventados)
- [ ] Countdown de retorno aparece quando há `data_retorno`
- [ ] Bottom nav: Hoje, Dieta, Treino, Coach (alvos fáceis de tocar)
- [ ] Menu “Mais” no mobile abre itens secundários

## Dieta

- [ ] Timeline de refeições com scroll fluido
- [ ] Plano A/B quando aplicável
- [ ] Checklist de refeição persiste após refresh
- [ ] Macros do plano activo coerentes com itens

## Treino

- [ ] “Iniciar sessão” no Hoje e na tab Treino
- [ ] Modo sessão fullscreen, timer, sair sem travar scroll
- [ ] Lista/PDF ainda acessíveis

## Check-in e progresso

- [ ] Check-in em 4 blocos com Próximo/Anterior
- [ ] Streak no Hoje e em Progresso
- [ ] Envio com toast de sucesso

## Fase 4 — Polish

- [ ] Onboarding 3 passos no primeiro acesso (ou após limpar `bh-student-onboarding-v1`)
- [ ] Empty states com ícone e CTA onde não há dieta/treino
- [ ] Notificações com etiqueta Coach / Sistema / Retorno
- [ ] `prefers-reduced-motion`: sem animações longas

## Registo de feedback

| Aluno/Coach | Dispositivo | Problema | Severidade |
|-------------|-------------|----------|------------|
|             |             |          |            |
