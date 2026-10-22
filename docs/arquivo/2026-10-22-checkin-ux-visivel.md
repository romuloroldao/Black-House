# Check-in — UX visível (2026-10-22)

## Problema

O rascunho do check-in (PR #15) era correto mas **invisível**: o aluno não via mudança na UI. Feedback: “naveguei e não vi alteração”.

## Entrega

| Onde | O quê |
|------|--------|
| Hoje | Banner dourado **Check-in em andamento** → Continuar (se há rascunho) |
| Check-in | Alerta **Rascunho recuperado** ao reabrir |
| Check-in | Cabeçalho com 5 blocos clicáveis + badge **Rascunho salvo** |
| Check-in | Botões **Próximo bloco / Enviar** no fluxo da página (não fixed — fixed cobria a resposta do coach) |
| Check-in | Opções de rádio em cartões tácteis (CSS `.form-checkin`) |
| Hoje / Mais do dia | Card de streak com CTA **Fazer agora** quando pendente |

## Como verificar

1. Login aluno → Check-in → responder 1–2 perguntas  
2. Ir a **Hoje** → deve aparecer o banner dourado  
3. Continuar → alerta de rascunho + blocos numerados + botão fixo em baixo  
4. Opções do questionário devem parecer cartões selecionáveis  
