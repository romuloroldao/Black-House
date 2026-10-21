# UX/UI — página Hoje agent-first (2026-07-26)

Auditoria com skill UX Expert + ajustes Motion mínimos.

## Problemas corrigidos

1. **Hierarquia** — chat e próxima ação sobem para o first viewport; PlanCards redundantes saem do modo agente.
2. **CTA** — botão primário pergunta ao agente (answer-first); detalhes são outline.
3. **Densidade** — máx. 4 chips; empty state com CTA visual; strip com `student-caption`.
4. **Copy** — unificada em português BR (“você”).
5. **Thumb** — composer sticky acima da bottom nav.
6. **Motion** — fade das bolhas + press scale com `motion-safe` / `prefers-reduced-motion`.

## First viewport

```
Saudação compacta
→ Próxima ação (perguntar no chat | ver detalhes)
→ Agente (chips · thread · composer)
—— abaixo ——
Context strip · streak/foto · insight · explorar
```
