# Coleman — escopo do assistente (Onda 5)

**Status:** superfície de produto no portal do aluno + edge function `coleman-assist`.  
**Público:** aluno autenticado.  
**Canal:** aba `Mais → Coleman` (não entra na bottom nav permanente).

## Permitido

- Dúvidas sobre dieta/cardápio atribuído (refeições, quantidades, substituições do mesmo grupo)
- Dúvidas sobre treino atribuído (séries, reps, descanso, T.E.P.)
- Como usar o check-in semanal
- Navegação do app

## Proibido

- Diagnóstico médico, exames, prescrição ou ajuste de fármacos/hormônios
- Mudar macros/calorias do plano sem o coach
- Criar treinos novos fora do plano
- Temas financeiros / jurídicos / saúde mental clínica

## Escalation

Quando a dúvida sair do escopo ou exigir julgamento clínico, a UI oferece **Falar com o coach** (`tab=chat`).  
A resposta da API pode sinalizar `escalate: true`.

## Dependências

- Secret `LOVABLE_API_KEY` no Supabase (mesmo gateway de `parse-student-pdf`)
- Deploy da function `coleman-assist` com `verify_jwt = true`
- Projeto Supabase com DNS ativo

## Métricas

- `coleman_opened`, `coleman_message_sent`, `coleman_escalated`
- Proteção: aumento de tickets / respostas fora de escopo reportadas pelo coach
