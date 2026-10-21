# Roadmap de excelência — Portal do Aluno (mobile)

**Tipo de trabalho (Design Excellence):** estratégia + priorização pós-auditoria  
**Decisão que este artefato deve destravar:** o que construir agora, o que adiar e o que *não* construir, sob urgência de reduzir atrito mobile.  
**Base:** `docs/ANALISE_JORNADA_ALUNO_MOBILE.md` + inspeção de `src/pages/StudentPortal.tsx` e `src/components/student/*`  
**Público prioritário:** aluno no celular (academia, cozinha, ritual semanal)  
**Fora de escopo deste roadmap:** redesign do painel do coach (salvo dependências de dados)

---

## 1. Diagnóstico

### Enunciado do problema

> Para o **aluno no celular**, existe **fricção alta para achar e completar tarefas** (treino, dieta, check-in, progresso), que causa **abandono, dependência de PDF/WhatsApp e baixa confiança nos números**. Precisamos entender se a **hipótese do shell desktop + rituais monólitos** explica o comportamento e identificar intervenções que melhorem **conclusão de tarefa e adesão semanal**.

### Scorecard Design Excellence (estado atual)

| Dimensão | Nota | Evidência | Próxima ação |
|----------|------|-----------|--------------|
| 1. Clareza do problema | 4 | Job-to-be-done e causa raiz nomeados na auditoria | Manter foco no shell + rituais |
| 2. Qualidade das evidências | 2 | **Fato:** código. **Informado:** “muita fricção”. **Desconhecido:** funis, heatmaps, quotes | Instrumentar + 5 entrevistas curtas |
| 3. Experiência / craft | 1 | Sidebar desktop, forms monólitos, progressive disclosure invertida | Onda 0–2 |
| 4. Viabilidade técnica | 4 | React/Vite/shadcn; `useIsMobile` já existe; mudanças incrementais | Reusar Sheet/Drawer existentes |
| 5. Mensuração | 1 | Sem baseline de conclusão de tarefa no repo | Onda 0 (instrumentação mínima) |
| 6. Integração interdisciplinar | 2 | Produto/Design/Eng ainda sem contrato de aceite compartilhado | Este roadmap como contrato |

**Não fazer média:** mensuração e craft estão críticos; craft “bonito” sem métrica não conta como sucesso.

### Hipótese central

| Tipo | Afirmação |
|------|-----------|
| **Hipótese** | A maior parte da fricção percebida vem do **shell não-mobile** e da **carga cognitiva dos rituais**, não da falta de features. |
| **Inferência** | Redesenhar treino/dieta sem bottom nav + Home “Hoje” **subentrega**. |
| **Risco se errada** | Se o aluno entra só via deep-link (WhatsApp → tela X), o shell importa menos que o destino — ainda assim o destino atual é desktop-first. |

---

## 2. O que *não* construir agora (urgência ≠ tudo junto)

Sob urgência, o erro clássico é abrir 5 frentes. **Não iniciar** enquanto Onda 0–1 não estiver estável:

| Não fazer | Por quê | Quando reconsiderar |
|-----------|---------|---------------------|
| Coleman / agente IA no app | **Fato:** ausente no repo; IA não corrige navegação | Após Onda 1 + canais de mensagem unificados |
| Redesign visual “mais moderno” do portal | Craft sem job-to-be-done desperdiça urgência | Depois do shell; tokens só se bloquear a11y |
| App nativo / PWA completa | Esforço alto; problema atual é IA + layout web | Se web mobile ainda falhar pós-Onda 2 |
| Reescrever Design System do zero | shadcn já existe; reuso > abstração | Só se tokens/contraste forem bloqueio real |
| Mais gráficos no dashboard | Dashboard já mente (mocks) | Só após dados reais |
| Unificar coach + aluno num único shell | Escopos e jobs diferentes | Fora do horizonte deste roadmap |

---

## 3. Princípios de execução (contrato)

Derivados da auditoria + pilares de UI intuitiva:

1. **Uma tarefa dominante por tela** (simplicidade).
2. **Bottom nav ≤5** — resto em Mais (consistência mobile).
3. **Essencial primeiro** — progressive disclosure não esconde o job (treino = exercícios).
4. **Feedback verdadeiro** — zero métricas mock em produção.
5. **Touch-first** — alvos ≥44px; nada só em hover.
6. **Persistência de trabalho** — rascunho de check-in; substituição de dieta no banco.
7. **Medir antes de celebrar** — cada onda tem métrica + proteção.

---

## 4. Roadmap por ondas (dependência técnica, não calendário)

> **Nota:** ondas descrevem **ordem e critérios de saída**, não estimativa em dias/semanas. Capacidade do time define o ritmo.

### Onda 0 — Fundamentos (desbloqueia aprendizado)

**Objetivo de negócio:** parar de voar às cegas sob urgência.  
**Hipótese de valor:** sem baseline, “melhoramos” vira opinião.

| ID | Entrega | Por quê importa | Evidência | Tipo | Aceite |
|----|---------|-----------------|-----------|------|--------|
| 0.1 | Eventos mínimos: `student_tab_view`, `checkin_started`, `checkin_submitted`, `checkin_abandoned`, `workout_opened`, `workout_pdf_exported`, `diet_sub_applied`, `diet_sub_persisted` | Saber o que dói | Código sem analytics hoje | Fato / Recomendação | Eventos disparando em staging; propriedades: `aluno_id` hash, `tab`, `device_width` |
| 0.2 | Remover ou rotular mocks do Dashboard (`5` treinos, `85%` dieta) | Feedback falso destrói confiança | `StudentDashboardView.tsx` hardcoded | Fato | Produção sem número inventado |
| 0.3 | 5 conversas curtas (10 min) com alunos que “não usam o app” | Calibrar se shell > check-in > treino | Lacuna qualitativa | Desconhecido → Pesquisa | Notas com job principal frustrado |

**Métrica principal:** instrumentação viva + zero mocks.  
**Proteção:** não atrasar Onda 1 por pesquisa perfeita — 0.3 pode rodar em paralelo.  
**Critério de saída:** 0.1 + 0.2 feitos; 0.3 iniciado.

---

### Onda 1 — Shell mobile + Home “Hoje” ⚡ prioridade máxima

**Objetivo:** aluno chega à tarefa em ≤2 toques.  
**Pilares:** consistência, simplicidade.

| ID | Entrega | Detalhe de experiência | Engenharia | Aceite |
|----|---------|------------------------|------------|--------|
| 1.1 | Bottom nav mobile | Itens: **Hoje · Treino · Dieta · Progresso · Mais**. Desktop pode manter sidebar. | `useIsMobile`; Sheet para Mais; não quebrar `?tab=` | Viewport &lt;768: sem sidebar permanente; nav fixa inferior; alvos ≥44px |
| 1.2 | Tela **Hoje** | 1 CTA primário (Treino de hoje **ou** Check-in pendente **ou** Próxima refeição) + ≤2 cards secundários + avisos não lidos | Reusar queries do dashboard; sem novos endpoints se possível | Em mobile, `/aluno` abre Hoje; um único botão primário visível above-the-fold |
| 1.3 | Mais | Agrupa: Check-in, Relatórios, Chat, Mensagens, Vídeos, Financeiro, Perfil (, Coleman depois) | Mover itens do `menuItems` | Nenhum item crítico órfão; deep-links `?tab=` continuam |

**Alternativa considerada e rejeitada (por agora):** só hamburger + drawer — melhora um pouco, mas **não** coloca ações no polegar nem força hierarquia “Hoje”.

**Métrica principal (após 0.1):** ↑ % sessões com ação útil em &lt;30s; ↓ bounce sem interação.  
**Proteção:** tempo médio em Hoje sem CTA (não pode subir).  
**Critério de saída:** mobile usável sem zoom/scroll horizontal na nav; Hoje com CTA real (não mock).

---

### Onda 2 — Ritual semanal (Check-in)

**Objetivo:** ↑ taxa de conclusão do check-in; ↓ abandono.  
**Pilares:** divulgação progressiva, feedback.

| ID | Entrega | Aceite |
|----|---------|--------|
| 2.1 | Wizard 5 passos (Nutrição · Treino · Hábitos · Bem-estar · Resumo) + barra de progresso | Não é mais um único scroll de ~25 campos |
| 2.2 | Autosave (localStorage e/ou tabela rascunho) | Refresh retoma no mesmo passo |
| 2.3 | Meta de água calculada (`peso × 0,035`) | Texto mostra litros sugeridos |
| 2.4 | Bloco opcional vs obrigatório (acordado com coach) | Obrigatório ≤12 perguntas **ou** justificativa escrita do coach mantendo 25 em camadas |
| 2.5 | Numeração e copy corrigidas | Sequência linear; sem “peso × 0,035” cru |

**Trade-off explícito:** cortar perguntas sem acordo do coach pode **piorar** o produto clínico. Preferir **camadas** a amputação.

**Métrica principal:** `checkin_submitted / checkin_started`.  
**Proteção:** tempo mediano até submit (não deve explodir); reclamações de coach sobre dados faltantes.  
**Critério de saída:** conclusão mensurável ↑ vs baseline Onda 0 **ou** hipótese refutada com dado.

---

### Onda 3 — Uso diário (Treino + Dieta)

**Objetivo:** app vira interface real na academia e na cozinha (não PDF).

#### 3A Treino — modo sessão

| ID | Entrega | Aceite |
|----|---------|--------|
| 3A.1 | “Treino de hoje” + CTA Começar | Um plano destacado por regra simples (primeiro ativo / tag do dia) |
| 3A.2 | Sessão: 1 exercício por tela, check, descanso, próximo | Exercícios **não** começam colapsados |
| 3A.3 | Vídeo inline / sheet | Não abre só em `_blank` como único caminho |
| 3A.4 | PDF em “Mais opções” | Não compete com Começar |
| 3A.5 | Labels (T.E.P. por extenso) | Sem sigla órfã |

#### 3B Dieta — cardápio do dia

| ID | Entrega | Aceite |
|----|---------|--------|
| 3B.1 | Refeição destacada por horário | Above-the-fold mostra “agora” |
| 3B.2 | Substitutos em bottom sheet (top 3) | Layout mobile; sem dialog desktop denso |
| 3B.3 | **Persistir** substituição no banco | Reload mantém troca (**Fato atual:** só estado local) |
| 3B.4 | Check “comi” (opcional mas recomendado) | Alimenta métrica real no Progresso |

**Métrica principal:** ↓ `workout_pdf_exported / workout_opened`; ↑ sessões com ≥1 exercício checked; ↑ `diet_sub_persisted`.  
**Proteção:** tempo para achar 1º exercício; erros de sync de substituição.  
**Critério de saída:** PDF deixa de ser caminho default; substituições sobrevivem ao reload.

---

### Onda 4 — Progresso verdadeiro + relatórios mobile

**Objetivo:** aluno confia no “estou melhorando?”.

| ID | Entrega | Aceite |
|----|---------|--------|
| 4.1 | Uma tela Progresso: score semanal + tendência + próximo check-in | Substitui densidade atual como default |
| 4.2 | 4 métricas-chave a partir de check-ins reais | Sem hardcoded |
| 4.3 | Relatório do coach full-screen (não `Dialog` max-w-3xl) | Legível em 375px |
| 4.4 | Fotos: delete sempre visível (touch) | Sem dependência de hover |

**Métrica principal:** retorno espontâneo à aba Progresso; leitura de relatórios.  
**Proteção:** suporte/coach reclamando de “aluno não vê relatório”.

---

### Onda 5 — Coleman (condicional)

**Só se:** Onda 1 estável **e** houver dono de escopo/modelo/segurança.  
**Fato:** zero superfície no repo hoje.

| ID | Entrega | Aceite |
|----|---------|--------|
| 5.1 | Escopo escrito: dúvidas operacionais dieta/treino/check-in; não diagnóstico médico | Doc aprovado |
| 5.2 | Entry em Mais + chips; cita plano ativo | Não é 12º item da bottom nav |
| 5.3 | Escalation para coach | Handoff testado |
| 5.4 | Unificar expectativa vs Chat/Mensagens | Aluno sabe quando usar cada canal |

**Métrica:** resolução sem coach; % escalation.  
**Proteção:** respostas perigosas / fora de escopo; aumento de tickets.

---

## 5. Comparativo de alternativas estratégicas

| Caminho | Prós | Contras | Decisão |
|---------|------|---------|--------|
| **A. Shell primeiro** (recomendado) | Maior alavancagem; barato relativo; reutiliza shadcn | Não melhora check-in sozinho | **Seguir** |
| B. Check-in primeiro | Dói no ritual semanal | Aluno ainda não acha a feature | Adiar para Onda 2 |
| C. “Big bang” redesign | Sensação de progresso interno | Alto risco, sem aprendizado | **Rejeitar** |
| D. Só conteúdo/copy | Rápido | Não resolve layout | Complementar, não substituir |

---

## 6. Plano de validação (proporcional)

| Onda | Método | Por quê este e não A/B |
|------|--------|-------------------------|
| 0 | Instrumentação + 5 entrevistas | Sem volume/desenho para A/B confiável (**Recomendação**) |
| 1 | Teste de usabilidade 3–5 alunos (tarefa: “faça check-in” / “ache treino de hoje”) | Rápido; reduz incerteza de IA |
| 2–3 | Funil de eventos + 1 rodada usabilidade | Comparar vs baseline Onda 0 |
| 5 | Dogfood interno + guardrails antes de alunos | Risco de conteúdo |

Não declarar sucesso só porque a PR mergeou.

---

## 7. Riscos e guardrails

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Coach rejeita check-in em camadas | Dados clínicos incompletos | Workshop 30 min; bloco avançado opcional |
| Substituição persistida diverge do plano do coach | Integridade nutricional | Flag “pendente de aprovação” ou histórico auditável |
| Bottom nav esconde Financeiro/Chat | Inadimplência / suporte | Badges em Mais; push/WhatsApp já existentes |
| Instrumentação com PII | Privacidade | Hash de IDs; sem corpo de mensagem nos eventos |
| Urgência pressiona pularem Onda 0 | Sem saber se melhorou | Mínimo: 0.1 + 0.2 antes de celebrar Onda 1 |

---

## 8. Critérios de sucesso do programa (não da entrega)

**Sucesso do programa** = combinação de:

1. **Experiência:** aluno completa job principal sem pedir ajuda ao coach/WhatsApp (observado em teste ou suporte ↓).  
2. **Produto:** ↑ conclusão check-in; ↓ dependência de PDF; substituições persistidas.  
3. **Negócio (hipótese):** ↑ retenção de uso semanal do portal — **só mensurável após Onda 0**.  
4. **Craft:** pilares ≥3/5 no re-score pós-Onda 1–2.  
5. **Engenharia:** sem regressão desktop do portal; mudanças incrementais em componentes student/*.

**Fracasso a declarar cedo:** Onda 1 lançada e `time-to-useful-action` não melhora → reabrir hipótese (deep-link? onboarding? conteúdo vazio?).

---

## 9. Backlog pronto para puxar (ordem sugerida de PRs)

1. ~~`fix(student): remove dashboard mock metrics` (0.2)~~ **feito** — tela Hoje sem 5/85% fake  
2. ~~`feat(student): analytics events skeleton` (0.1)~~ **feito** — `src/lib/studentAnalytics.ts` + eventos nas telas-chave  
3. ~~`feat(student): mobile bottom nav + Hoje` (1.1–1.3)~~ **feito** — bottom nav + Mais sheet + CTA primário  
4. ~~`feat(student): check-in wizard + autosave` (2.x)~~ **feito**  
5. ~~`feat(student): workout session mode` (3A)~~ **feito**  
6. ~~`feat(student): diet day view + persist substitutions` (3B)~~ **feito**  
7. ~~`feat(student): progress truth + mobile reports` (4.x)~~ **feito**  
8. ~~`feat(student): coleman assist (gated)` (5.x)~~ **feito (código)** — deploy da function + `LOVABLE_API_KEY` pendente no projeto  

Cada PR: critérios de aceite da tabela da onda + estados loading/vazio/erro + viewport 375 e 768.

### Status de implementação (código)

| Item | Status | Arquivos |
|------|--------|----------|
| 0.1 Analytics skeleton | Feito | `src/lib/studentAnalytics.ts` |
| 0.2 Remover mocks | Feito | `StudentDashboardView.tsx` |
| 1.1–1.3 Shell mobile | Feito | `StudentBottomNav.tsx`, `StudentPortal.tsx` |
| 2.1–2.5 Check-in wizard | Feito | `StudentWeeklyCheckin.tsx` |
| 3A Treino sessão | Feito | `StudentWorkoutsView.tsx` |
| 3B Dieta do dia | Feito | `StudentDietView.tsx` |
| 4.x Progresso + relatórios | Feito | `StudentProgressSummary.tsx`, `StudentReportsView.tsx` |
| 5.x Coleman | Feito no código | `StudentColemanView.tsx`, `supabase/functions/coleman-assist`, `docs/COLEMAN_ESCOPO.md` |
| 0.3 Entrevistas | Pendente (pesquisa) | — |
| Deploy coleman-assist | Pendente ops | Secret `LOVABLE_API_KEY` + `supabase functions deploy coleman-assist` |

---

## 10. Lacunas explícitas (não inventar)

- Volume de alunos ativos no app / semana — **desconhecido**  
- % que usa só WhatsApp — **desconhecido**  
- Coleman fora deste repo — **desconhecido** (pode existir noutro canal)  
- Baseline de conclusão de check-in — **desconhecido até Onda 0**  

Este roadmap é **recomendação** sustentada por **fato de código** + **informação do solicitante** (“fricção urgente”). Ajuste a ordem 2↔3 se as 5 entrevistas mostrarem que academia dói mais que o ritual semanal.
