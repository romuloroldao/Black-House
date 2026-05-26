# Roadmap pós-validação — 2026-05-26

**Validação:** aceite 2026-05-26 · código em `lancamento` / `melhoria-aluno`  
**Actualização:** 2026-05-25 · `lancamento` alinhado com `melhoria-aluno` (`847ef57`)

---

## Import P1 — fechado (excepto lote)

| Item | Estado | Notas |
|------|--------|--------|
| `data_retorno` em `confirm-diet` | ✅ | Schema + `buildDietaPayload` envia ISO `YYYY-MM-DD` |
| Substituir dieta activa | ✅ | `replace_active_diet` + checkbox no import enrich |
| Wizard «Novo Aluno» → import | ✅ | Após criar aluno, diálogo «Importar ficha agora?» |
| Histórico de importações | ✅ | `GET /api/import/history` + painel no perfil do aluno |
| Card estado portal no perfil | ✅ | `GET /api/alunos/:id/portal-status` + `StudentPortalStatusCard` |
| Bug telefone no create | ✅ | `StudentService` repassa `telefone` ao repositório |
| Importação contextual P0 (create/enrich) | ✅ | Ver `2026-05-25-especificacao-importacao-contextual-p0.md` |
| **Importação em lote** | ⏸️ | **Pausada** — retomar quando priorizado |

---

## Check-in coach — Sprint 1–4

**001–010** (timeline, drawer, delta, inbox, respondido, filtros, highlights, gráfico, busca, notificações): ✅  
Detalhe: `docs/arquivo/2026-05-25-tickets-checkin-coach-ux.md`

| Ticket | Título | Estado | Notas |
|--------|--------|--------|--------|
| BH-CHECKIN-011 | Resumo IA tendências (4 semanas) | ✅ | `POST /api/weekly-checkins/ai/trends-summary` — requer LLM no servidor |
| BH-CHECKIN-012 | Rascunho resposta IA editável | ✅ | `POST /api/weekly-checkins/:id/ai/draft-response` |
| BH-CHECKIN-013 | Comparação side-by-side duas semanas | ✅ | `CheckinSideBySideCompare` (timeline, inbox, drawer) |
| BH-CHECKIN-014 | Export PDF do check-in | ✅ | `checkinPdfExport.ts` |
| BH-CHECKIN-015 | Inbox por equipa (head coach) | ✅ | `resolveCoachScope` em `GET /api/weekly-checkins` + role `assistant` |

**Dívida `feedbacks_alunos`:** ✅ `API_CONTRACT.feedbacksAlunos` + métodos no `apiClient` (rotas `/api/feedbacks-alunos`).

---

## Polish pós-MVP portal — fechado

| Item | Estado | Notas |
|------|--------|--------|
| Histórico de cargas na sessão de treino | ✅ | `localStorage` `bh-workout-load-history`, input + «última vez» |
| Macros só plano activo (não somar A+B) | ✅ | `StudentDietView` + `StudentImporter` + `DietViewer` (toggle A/B) |
| Virtualização lista alimentos (>50) | ✅ leve | Combobox cap 60/100; `content-visibility` em listas longas do import |

---

## Próximas prioridades sugeridas

1. **QA em produção** — comparar 2 semanas, inbox com assistente, botões IA (se provider configurado).
2. **Importação em lote** — só quando retomar o epic.
3. **Outros épics** — financeiro, mensagens, relatórios, ou melhorias de dados alimentares (conforme negócio).

---

## Histórico de entregas recentes

| Commit | Entrega |
|--------|---------|
| `847ef57` | Check-in 011–015 + API feedbacks |
| `0c05120` | Fix telefone no import |
| `dc70bdd` | Card estado portal |
| `0704820` | Histórico importações |
| `1afca46` | Export PDF check-in (014) |
| `73e356d` | Polish pós-MVP portal |
