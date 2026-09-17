# Spec Phase 7 — Coach Agent HITL (ciclo 2026-08-19)

| Campo | Valor |
|-------|--------|
| **Data** | 2026-08-19 |
| **Estado** | Runtime = Incrementos D + E. Orquestrador LLM do coach **não** entra neste ciclo. |
| **Dependências** | Carteira 7d (A), `coach_rules` UI (B), sessão de treino no servidor (C) |

## O que a Phase 7 era

Rótulo de 26 de Julho: agente no **coach**, autonomia 1–3, humano no meio. Caso UC-14: priorizar carteira / rascunhos supervisionados.

Não havia spec. Construir um chat no back-office sem carteira de execução repetiria o falso contexto que a Phase 1a proibiu no aluno.

## O que este ciclo entrega (é o HITL)

1. **Fila determinística** no inbox de check-ins  
   Score = check-in pendente (40) + misses×8 (cap 40) + dieta &lt;40% (20) + treino &lt;50% (15) + prioridade do formulário (12).  
   Filtro «Queda de execução 7d». Sem LLM na ordenação.

2. **Rascunho supervisionado enriquecido**  
   `POST /api/weekly-checkins/:id/ai/draft-response` passa a incluir insight 7d + `coach_rules` (triggers `checkin`/`always`).  
   O coach vê, edita e **grava**. Nada é enviado sozinho.

3. **Pré-requisitos no produto**  
   - `GET /api/coach/me/adherence-carteira` + bloco no Dashboard  
   - Tab Configurações → Método (`coach_rules`)  
   - Sessão de treino hidratada do PostgreSQL (localStorage só resume ≤2h)

## Fora (7b — só se E não chegar)

Medir 2 semanas: % rascunhos usados, mediana envio→resposta, % cliques na fila vs. ordenação antiga.

**Só então** um orquestrador coach (tools READ da carteira + `draft_checkin_response`, autonomia 1–3). Proibido: send autónomo, `modify_diet` / `modify_workout`, financeiro, acesso.

Não: vector KB, voz, multi-agente, tab Análises.

## Aceite deste ciclo

- Coach vê quem falhou dieta/treino em 7 dias sem abrir ficha a ficha.  
- Inbox ordena por atenção, não só por data.  
- Rascunho IA cita execução quando houver dados; regras do método entram no prompt.  
- Gravar resposta continua a ser acção humana.
