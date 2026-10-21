# Spec Phase 4 — Contextual Nutrition (as-built)

**Data:** 2026-07-26  
**Âmbito:** portal aluno  
**Dependências:** Phase 1a (conclusões), vision meal photo existente, equivalência alimentar

## Objectivo

Permitir trocas isocalóricas **persistidas para o dia** (sem alterar o plano do coach) e orientar o aluno em restaurante → foto de refeição livre.

## Entregue

### Persistência
- Tabela `refeicao_substituicoes` (override por `aluno + item_dieta + data_ref + plano`)
- API: `GET/PUT/DELETE /api/alunos/me/refeicao-substituicoes`
- `StudentDietView` aplica overrides no load e grava no diálogo de substitutos

### Agente
- `list_substitutions` chama equivalência real
- `apply_substitution` / `clear_substitution` (WRITE 2)
- Intent «substituir» → abre dieta
- Intent «restaurante» → `meal_photo` (já existente; vision via UI)

### Fora / próximo
- Agente a gravar foto sem UI (`save_meal_photo_analysis` directo)
- Open Food Facts
- Phase 5 behavioral intelligence
