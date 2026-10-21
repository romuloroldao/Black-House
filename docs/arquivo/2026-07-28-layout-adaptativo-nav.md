# Layout adaptativo — navegação compacta / expandida (2026-07-28)

Princípio: **A navegação ocupa só o necessário. O resto pertence ao conteúdo e ao agente.**

## 1. Diagnóstico

| Aspecto | Estado pré-mudança |
|---------|-------------------|
| Desktop | `StudentSidebar` fixa `md:w-64` (ícone + texto) |
| Mobile | Bottom nav + drawer expandido |
| Collapse | Não existia |
| Preferência | Não persistida |
| Agent Home | Ganha largura automaticamente via `flex-1` |

## 2. Oportunidades

- ~192px horizontais para o chat no modo compacto
- Menos competição visual com o agente
- Melhor leitura em notebooks 13–14"

## 3. Arquitectura

Um único `StudentSidebar` com `mode: compact | expanded`:

- **Compact (default):** `w-16`, só ícones, tooltips, hover-expand temporário da rail
- **Expanded:** `w-64`, ícone + texto (comportamento clássico)
- Mobile drawer: sempre labels (não usa compact)

Estado: `useStudentNavMode` + `localStorage` (`bh-student-nav-mode`).

## 4. Persistência

`safe-storage` → `bh-student-nav-mode`. Sem API de UI prefs ainda; sync backend fica para fase 2.

## 5. Responsividade

| Viewport | Comportamento |
|----------|---------------|
| md+ | Compact / Expanded toggle |
| Mobile | Bottom nav + drawer completo |

## 6. Plano incremental

1. ✅ Hook + sidebar dual-mode + toggle + a11y  
2. ✅ Hover expand + tooltips  
3. ⏳ Sync preferência no perfil (API)  
4. ⏳ Densidade de cards/gráficos nas tabs não-agente  

## 7. Testes

- Toggle sem reload / preserva tab e chat  
- Reload mantém modo  
- Teclado: foco no toggle + Enter/Space  
- Tooltips em compact; hover expand mostra labels  
- Mobile inalterado  

## 8. Impacto Agent First

Chat e cards ocupam quase toda a largura útil; navegação deixa de ser o “herói” visual.
