# Coleman — agente de nutrição e performance

**Data:** 2026-08-11

## Posicionamento

Coleman é o especialista pessoal em nutrição e performance **dentro** da Black House.
Logo e branding Black House permanecem intactos.

## O que mudou

| Área | Mudança |
|------|---------|
| UI | Header COLEMAN + avatar «C»; conversa dominante; chips secundários horizontais |
| Composer | Placeholder «Fale com o Coleman...» |
| Opening | Briefing dinâmico (hora/treino/refeição); 1ª vez apresenta-se; chave `v4` |
| Chips | Contextuais (próxima refeição, trocar, analisar, …); textos fast-path preservados |
| FAB | «Coleman» em vez de «Agente» |
| Prompt | `v1.5-coleman` — ENTENDE → RECOMENDA → EXPLICA → AGE |
| Composer backend | Substituição recomenda opção principal; meal copy contextual |
| Acções | Confirmação inline + **Desfazer** (`clear_substitution`) |

## Ficheiros

- `src/components/student/agent/ColemanHeader.tsx`
- `compose-home-opening.ts`, `agent-chips.ts`, `StudentTodayView.tsx`
- `AgentComposer`, `AgentThread`, `AgentActionCard`, `AgentReturnFab`
- `useStudentAgent.ts` (undo)
- `server/services/agent/prompts.js`, `response-composer.js`

## Aceite (revisão)

1. Parece um agente? Sim — header + conversa + opening.
2. Coleman protagonista? Sim (sem mexer no logo BH).
3. Conversa > botões? Sim — chips ghost/secundários.
4. Respostas personalizadas? Melhoradas no composer + prompt.
5. Contexto usado? Opening dinâmico + recomendações de troca.
6. Recomendações → acções? Cards + confirmação/desfazer.
7–10. DS BH, mobile-first, logo intacto.
