# Ajuste do agente ao mock Black House

**Data:** 2026-08-06

## Objectivo

Alinhar o Agent Home (tab Hoje) às diretrizes do mock: tom de coach, opening narrativo, chips fixos com ícones de marca, e substituição alimentar como lista clicável.

## Mudanças

| Área | Antes | Depois |
|------|--------|--------|
| Opening | Checklist com bullets | 2–3 frases narrativas + CTA |
| Chips | Dinâmicos por contexto | Sempre: dieta, treino, trocar, foto, peso |
| Ícones chips | `text-foreground` | `text-primary` (amarelo de marca) |
| Substituição | N cards com botão | 1 card com rows clicáveis (`name · Ng >`) |
| Prompt LLM | Tom operativo | + coach humano, pt-BR, cards com `items[].action` |
| Opening key | `bh-agent-opening-v2-*` | `v3` (força novo greeting no dia do deploy) |

## Ficheiros

- `src/components/student/agent/compose-home-opening.ts`
- `src/components/student/agent/agent-chips.ts`
- `src/components/student/agent/AgentActionCard.tsx`
- `src/components/student/StudentTodayView.tsx`
- `src/hooks/useStudentAgent.ts` (`AgentCardItem.action`)
- `server/services/agent/response-composer.js`
- `server/services/agent/prompts.js` (`PROMPT_VERSION` v1.4)
- `server/tests/agent-food-replacement.test.js`

## Aceite

- Greeting do dia soa a coach (descanso / treino / próxima refeição / foto)
- Barra de atalhos mostra os 5 do mock com ícones amarelos
- «Trocar arroz por macarrão» devolve lista tocável que aplica só hoje
- Respostas LLM pedidas em pt-BR com tom próximo
