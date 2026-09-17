# Fix sessão guiada — séries 2/3 e CTA durante descanso

**Data:** 2026-08-06

## Problema

Após registar a série 1, o aluno preenchia carga/reps durante o descanso mas o botão principal ficava desactivado (`restSecondsLeft > 0`). No telemóvel o teclado cobria o footer fixo; “tocar na carga e OK” só revelava o botão. Um `useEffect` dependente de `loadHistory` limpava as reps após cada sync.

## Correções

| Área | Mudança |
|------|---------|
| CTA | Activo durante descanso; «Registar série N · pular descanso» (entre séries) ou «Pular descanso · próximo exercício» (entre exercícios); label «A guardar…» enquanto sync debounce |
| Teclado | `visualViewport` padding; `inputMode="decimal"`; `blur` no submit; `scrollIntoView` no focus |
| Formulário | Reset de reps/carga só em mudança de `currentIndex` |
| Persistência | `currentIndex`, `currentSet`, `restEndsAt`, `restMode`, `restPausedLeft`, `setLogs`; `initialIndex` = primeiro incompleto |
| Logbook | Lista local série-a-série; sync em background com toast se falhar |
| Timer | Countdown a partir de `restEndsAt`; banner «Descanso pausado» |

## Ficheiros

- `src/components/student/StudentWorkoutSessionView.tsx`
- `src/lib/workout-session-utils.ts`
- `server/tests/guided-workout.helpers.test.js`

## Aceite

- Registar 3 séries no mesmo exercício sem “truques” de foco
- Durante descanso entre séries o CTA regista a próxima
- Ao sair e voltar no mesmo dia, série e descanso retomam
