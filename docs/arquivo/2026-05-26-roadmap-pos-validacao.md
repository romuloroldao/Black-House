# Roadmap pós-validação — 2026-05-26

**Validação:** aceite 2026-05-26 · código em `lancamento` / `melhoria-aluno`

---

## Import P1 — em curso / feito nesta entrega

| Item | Estado | Notas |
|------|--------|--------|
| `data_retorno` em `confirm-diet` | ✅ | Schema + `buildDietaPayload` envia ISO `YYYY-MM-DD` |
| Substituir dieta activa | ✅ | `replace_active_diet` + checkbox no import enrich |
| Wizard «Novo Aluno» → import | ✅ | Após criar aluno, diálogo «Importar ficha agora?» |
| Histórico de importações | ✅ | `GET /api/import/history` + painel no perfil do aluno |
| Card estado portal no perfil | ⏳ | Backlog |
| Importação em lote | ⏳ | Backlog |
| Bug telefone no create | ⏳ | Pré-existente |

---

## Check-in Sprint 4+ (futuro)

| Ticket | Título | Esforço |
|--------|--------|---------|
| BH-CHECKIN-011 | Resumo IA tendências (4 semanas) | L |
| BH-CHECKIN-012 | Rascunho resposta IA editável | L |
| BH-CHECKIN-013 | Comparação side-by-side duas semanas | M |
| BH-CHECKIN-014 | Export PDF do check-in | M ✅ |
| BH-CHECKIN-015 | Inbox por equipa (head coach) | L |

**Dívida:** rota semântica dedicada para `feedbacks_alunos` (sair de `/rest/v1/`).

---

## Polish pós-MVP portal

| Item | Estado | Notas |
|------|--------|--------|
| Histórico de cargas na sessão de treino | ✅ | `localStorage` `bh-workout-load-history`, input + «última vez» |
| Macros só plano activo (não somar A+B) | ✅ | `StudentDietView` + `StudentImporter` + `DietViewer` (toggle A/B) |
| Virtualização lista alimentos (>50) | ✅ leve | Combobox cap 60/100; `content-visibility` em listas longas do import |

---

## Ordem sugerida (próximas sprints)

1. ~~Deploy + smoke do Import P1~~ ✅
2. ~~BH-CHECKIN-014 Export PDF~~ ✅ (`CoachCheckinDetailSheet` + `checkinPdfExport.ts`)
3. **Próximo:** Card estado portal no perfil + importação em lote
4. IA check-in (011–012) quando API LLM estiver estável
