# Home AI First — Command Center

Data: 2026-07-31

## Resumo

A tab Hoje do portal aluno passou a um layout **AI First**: o assistente ocupa a maior parte da área útil; o contexto do dia fica num resumo compacto + painel «Mais do dia» recolhível.

## Alterações

| Peça | Ficheiro |
|------|----------|
| Header mais baixo + padding Hoje | `src/pages/StudentPortal.tsx` |
| Resumo inteligente (ícones Lucide) | `src/components/student/agent/TodaySmartSummary.tsx` |
| Greeting proactivo local (1×/dia) | `compose-home-opening.ts` + `useStudentAgent.injectLocalOpening` |
| Chips contextuais (máx. 4) acima do composer | `agent-chips.ts` + `StudentTodayView` |
| Removido «Perguntar» / header «Agora» | `StudentTodayView` |
| Chat full-bleed no mobile | secção sem border/radius em `max-md` |

## Comportamento

1. Ao abrir Hoje com thread vazia → mensagem assistant local com dieta/treino/pendências.
2. Chips mudam com `proxima-acao` + sinais de `me/hoje` (descanso, foto, coach unread…).
3. «Mais do dia» fechado por defeito no mobile; trigger de uma linha.
4. Ramo `VITE_AGENT_DAILY_ENABLED=false` (cards tradicionais) intacto.

## Update: sem bento — briefing no chat

O bento de 4 cards foi removido. Refeição / treino / foto / streak entram na **mensagem de abertura do agente (1×/dia)**. A Home maximiza a área do chat; «Mais do dia» fica só como linha recolhível.
