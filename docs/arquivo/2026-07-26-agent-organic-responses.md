# Respostas orgânicas do Daily Agent

| Campo | Valor |
|-------|--------|
| **Data** | 2026-07-26 |
| **Âmbito** | Compositor de respostas + `get_next_workout` / agenda |

## Problema

Perguntas naturais (ex.: «qual é o meu próximo treino?») caiam no fast path de **hoje** e devolviam templates curtos («Hoje é dia de descanso») sem próximo passo.

## Solução

```text
Intenção (regex melhorada)
  → Tools (get_next_workout, get_next_action, agenda)
  → response-composer (texto + cards)
  → Aluno
```

### Novidades

| Peça | Path |
|------|------|
| Compositor | `server/services/agent/response-composer.js` |
| Tools | `get_next_workout`, `get_week_agenda` em `tools/read-context.js` |
| Intents | `next_workout`, `late`, `resume` separados |
| Prompt LLM | v1.1 — assertivo + `get_next_workout` |

### Exemplos de resposta (descanso)

Antes: `Hoje é dia de descanso na tua agenda.`

Depois: `Hoje é dia de descanso na tua agenda. O teu próximo treino é amanhã: «Treino A». Enquanto isso, a próxima acção do plano é a alimentação (almoço).` + cards.

### Cobertura enriquecida

- Próximo treino / quando treino  
- Treino do dia / descanso → olha agenda à frente  
- Próxima refeição / o que como  
- Atrasado / voltei  
- Como estou (insight + próxima acção)  
- Restaurante  

### Testes

`server/tests/agent-organic-responses.test.js`
