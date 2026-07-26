# Spec Phase 6 — Coach Knowledge (as-built)

**Data:** 2026-07-26  
**Âmbito:** regras tipadas do coach → Daily Agent (aluno); CRUD mínimo coach  
**Fora:** vector KB, Coach Agent HITL (Phase 7)

## Objectivo

O agente do aluno respeita a **filosofia operacional** do coach (bullets curtos), sem embeddings.

## Entregue

### Schema
- `public.coach_rules` — domain, trigger, priority, title, body (≤500), source

### Agent
- `context-builder` injeta `coach_rules` + `free_meal_hint`
- Seed automático a partir de `dietas.refeicao_livre_observacao` (uma vez por coach)
- Tool READ `list_coach_rules`
- Fast paths restaurant / substitution ecoam regras relevantes
- Prompt: cumprir `coach_rules`; plano estruturado prevalece em conflito

### API coach
- `GET/POST /api/coach/rules`
- `PATCH/DELETE /api/coach/rules/:id`

## Próximo
- Phase 7 Coach Agent (HITL)
- UI coach para editar regras (opcional; API já basta)
