# Check-in — jornada desktop equilibrada (2026-10-22)

## Diagnóstico (Design Excellence)

| Elemento | Problema | Impacto |
|----------|----------|---------|
| Card “Resposta do seu coach” full-width | Dominava ~40% da dobra; `whitespace-pre-wrap` + newlines vazios inflavam a altura | Bloco 1/5 (tarefa) ficava espremido no fundo |
| Ordem vertical título → feedback → formulário | Feedback secundário antes da tarefa primária | Hierarquia invertida no desktop |
| Padding do `main` + fila de notificações | Espaço morto no topo | Menos viewport para o formulário |

## Decisão

1. **Tarefa primeiro na hierarquia visual (desktop):** grid `formulário | feedback`.
2. **Feedback compacto:** altura limitada + scroll interno; normalizar newlines.
3. **Mobile:** feedback curto acima (order), sem card gigante.
4. **Chrome:** menos `pt`/`mb` na tab check-in.

## Aceite

- Em ~1280×800, o cabeçalho dos blocos (1–5) e o início de peso/fotos entram na primeira dobra.
- A resposta do coach não cria faixa vazia enorme; texto longo faz scroll dentro do painel.
- Mobile continua legível; sem regressão do CTA fixed (já removido).
