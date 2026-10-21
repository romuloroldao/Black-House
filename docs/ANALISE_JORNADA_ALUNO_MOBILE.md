# Análise da jornada do aluno no celular

**Escopo:** pontos de contato — relatório/check-in semanal, métricas, Coleman, treino, dieta/cardápio.  
**Método:** inspeção estática do portal do aluno (`/aluno`) no código deste repositório.  
**Limite:** sem analytics de sessão nem quotes de cliente anexados; severidade é heurística + evidência de código.  
**Framework de avaliação:** pilares de interface intuitiva (simplicidade, consistência, feedback, acessibilidade) + práticas de navegação (bottom nav, divulgação progressiva, ícones universais).

---

## Pilares × estado atual do portal

Os quatro pilares são um bom norte — e **batem** com o diagnóstico do shell. Mas não são suficientes sozinhos: faltam *hierarquia de tarefa*, *persistência de trabalho* e *verdade dos dados*. Abaixo, nota 1–5 por evidência de código (não por opinião de marca).

### Scorecard

| Pilar / prática | Nota | Evidência no código | O que “bom” parece no Black House |
|-----------------|------|---------------------|-----------------------------------|
| **Simplicidade** | 1/5 | 11 itens de menu; check-in com ~25 campos numa tela; dashboard de progresso densíssimo | 1 tarefa dominante por tela; Home “Hoje” com 1 CTA |
| **Consistência (padrões mobile)** | 1/5 | Sidebar lateral (padrão desktop/web admin), não bottom nav; Dialogs `max-w-3xl` | Bottom nav 4–5 destinos; sheets em vez de modais desktop |
| **Feedback imediato** | 2/5 | Toasts em check-in/chat/upload; badge de chat; **sem** progresso de formulário, **sem** confirmação de “comi”/série feita | Micro-confirmação em toda ação irreversível ou ritual (check-in passo a passo, check de exercício) |
| **Acessibilidade** | 2/5 | Botões `size="sm"` / ícone-only; delete de foto só em `hover`; sliders e radios densos; contraste depende do tema | Alvos ≥44px; ações touch-first; contraste AA; labels explícitas (ex.: T.E.P.) |
| **Bottom navigation** | 0/5 | Ausente | Hoje · Treino · Dieta · Progresso · Mais |
| **Divulgação progressiva** | 1/5 | Invertida: mostra metadados primeiro e esconde exercícios; check-in mostra tudo de uma vez | Essencial primeiro; avançado sob “mais” / passo seguinte |
| **Ícones universais** | 3/5 | Lucide coerente (Home, Utensils, Dumbbell…); labels longas competem com ícones | Ícone + label curta na bottom nav; evitar jargão (T.E.P., “recursos hormonais” sem contexto) |

### Onde o framework precisa de freio (rigor)

1. **Simplicidade ≠ remover o que o coach precisa.** Check-in clínico pode permanecer — mas em camadas (mínimo obrigatório → opcional), não em “menos perguntas” cego.
2. **Consistência com apps genéricos** ajuda descoberta; **consistência interna** (mesmos padrões de sheet, toast, empty state) importa mais depois do 2º uso. Hoje falham as duas.
3. **Feedback imediato** sem **verdade**: o dashboard já “confirma” 85% de dieta e 5 treinos — feedback falso é pior que silêncio.
4. **Divulgação progressiva** mal aplicada esconde o job (exercícios atrás de collapsible). Progressive disclosure serve para *complexidade*, não para *conteúdo da tarefa*.
5. **Bottom nav** com mais de 5 itens vira o mesmo problema da sidebar. “Mais” é obrigatório; Coleman/financeiro/relatórios não merecem slot permanente no dia 1.

---

## Veredito (não concordar com o sintoma sem testar a causa)

A premissa “os clientes têm dificuldade de usar as features no celular” é **parcialmente verdadeira**, mas a causa raiz mais forte no código **não é** a complexidade isolada de treino/dieta/check-in.

É o **shell desktop** do portal do aluno rodando em viewport mobile:

| Evidência | Onde |
|-----------|------|
| Sidebar fixa `w-64` sem drawer / bottom nav / hamburger | `StudentSidebar.tsx` |
| 11 itens de menu no mesmo nível | `menuItems` em `StudentSidebar.tsx` |
| Conteúdo com `p-6` ao lado da sidebar | `StudentPortal.tsx` |
| Hook `useIsMobile` existe e **não é usado** no portal do aluno | `hooks/use-mobile.tsx` |

**Implicação:** redesenhar features sem redesenhar navegação mobile tende a **subentregar**. O aluno continua “perdido” antes de chegar na tarefa.

---

## Mapa dos 5 pontos de contato (+ shell)

### 0. Shell / navegação — severidade **crítica**

**Job:** chegar à tarefa do dia em ≤2 toques.

**Jornada atual**

1. Abre `/aluno`
2. Sidebar larga + conteúdo estreito
3. Escolhe entre 11 labels
4. Troca `?tab=` e perde contexto

**Jornada proposta**

1. Bottom nav: **Hoje · Treino · Dieta · Progresso · Mais**
2. Tela **Hoje** = 1 CTA primário (treino / check-in pendente / próxima refeição) + no máximo 2 secundários
3. Check-in, relatórios, financeiro, Coleman → **Mais**
4. Sem sidebar permanente no mobile

**Contra-ponto:** se analytics mostrarem que a maioria já entra via deep-link externo (WhatsApp), o shell importa menos que as telas de destino. Ainda assim, o layout atual prejudica *qualquer* destino.

---

### 1. Relatório semanal (= Check-in Semanal no app) — severidade **crítica**

No produto do aluno, o ritual semanal é `StudentWeeklyCheckin` (não o relatório do coach). O relatório do coach é outra superfície (`StudentReportsView`).

**Job:** registrar a semana em 3–5 min, com rascunho, e sentir progresso.

**Fricções (código)**

- ~25 perguntas em **um** formulário, sem wizard / progresso / autosave (`StudentWeeklyCheckin.tsx`)
- Refresh ou erro no final = perda total do preenchimento
- Numeração inconsistente (salta 15 → 21 → 16…)
- “Água mínima (peso × 0,035)” sem valor calculado para o aluno
- Escala Bristol + 7 radios em tela estreita
- Submit all-or-nothing

**Jornada proposta**

1. Card na Home: “Check-in da semana · ~4 min”
2. Wizard em 5 passos: Nutrição → Treino → Hábitos → Bem-estar → Resumo
3. Autosave a cada resposta; retomar no mesmo passo
4. Meta de água já calculada com o peso do aluno
5. Tela final com 3 insights + atalho para Progresso

**Teste da premissa:** 25 perguntas clínicas podem ser certas para o **coach** e erradas para **adesão**. Separar bloco mínimo obrigatório de bloco avançado opcional — não assumir que “mais dados = melhor acompanhamento” se o aluno abandona o formulário.

---

### 2. Acompanhamento de métricas — severidade **alta**

Superfícies envolvidas: Dashboard, Meu Progresso (`StudentProgressDashboard`), Meus Relatórios.

**Job:** em 10 segundos, responder “estou melhorando?”.

**Fricções**

- Dashboard com métricas **hardcoded** (`Treinos/Semana: 5`, `Dieta: 85%` em `StudentDashboardView.tsx`) — quebra confiança
- Três conceitos paralelos (Check-in / Progresso / Relatórios) sem hierarquia
- Dashboard de progresso densíssimo (~879 linhas), pensado para desktop
- Relatório do coach em `Dialog` `max-w-3xl` — ruim no celular
- Delete de foto só em `hover` — inexistente no touch

**Jornada proposta**

1. Uma tela **Progresso**: score da semana + tendência + próximo check-in
2. Quatro métricas-chave (adesão, treino, sono, autoestima) com drill-down
3. Relatório do coach como card/página full-screen, não modal desktop
4. Remover mocks ou rotular explicitamente como placeholder

**Teste da premissa:** mais gráficos ≠ mais clareza. No mobile, 1 número + 1 tendência + 1 frase do coach costuma vencer um painel de coach reempacotado.

---

### 3. Coleman (agente de IA) — severidade **gap de produto**

**Fato:** neste repositório **não há** referência a Coleman / agente de IA no portal do aluno. O chat existente é só com o coach humano (`StudentChatView`).

**Implicação:** se Coleman é um ponto de contato prometido aos clientes, a fricção aqui não é “UX ruim” — é **ausência** (ou existência fora deste código: WhatsApp, outro app, BDK).

**Jornada proposta (só depois do shell estável)**

1. Escopo claro: dúvidas operacionais de dieta/treino/check-in (não diagnóstico)
2. Entry point único (Assistente) + chips de pergunta
3. Respostas citando o plano ativo do aluno
4. Escalation para o coach quando confiança baixa
5. Não competir com Chat + Mensagens do Coach sem unificar canais

**Teste da premissa:** priorizar Coleman antes do shell mobile maquia sintomas. IA não corrige navegação quebrada.

---

### 4. Treino — severidade **alta**

**Job:** executar o treino de hoje na academia com uma mão.

**Fricções**

- Exercícios **colapsados por padrão** — o conteúdo útil exige toque extra
- Header com badges + PDF estoura em tela estreita
- Sem modo sessão (um exercício por vez, check-off, descanso)
- Sigla **T.E.P.** sem legenda
- Vídeo em nova aba (quebra fluxo no celular)
- PDF como caminho principal sugere que o app não é a UI real de execução
- Sem “treino de hoje” entre vários planos ativos

**Jornada proposta**

1. Home: “Treino de hoje · A” → Começar
2. Modo sessão: 1 exercício / tela → check → descanso → próximo
3. Vídeo inline / bottom sheet
4. PDF em “Mais opções”
5. Depois: registro simples de carga/série

**Teste da premissa:** se o aluno depende do PDF impresso, o produto digital falhou na academia — exportar PDF não é feature, é sintoma.

---

### 5. Dieta / cardápio — severidade **alta**

**Job:** saber o que comer agora e trocar alimento com confiança.

**Fricções**

- Layout horizontal alimento + “Ver Substitutos” quebra no mobile
- Substituição **só em estado local** — não persiste no banco (`handleSubstituir` em `StudentDietView.tsx`); some no reload
- Carrega catálogo inteiro de alimentos no client
- Sem “refeição atual” por horário
- Sem check “comi esta refeição”
- Macros sem meta individual contextualizada

**Jornada proposta**

1. Cardápio do dia com refeição destacada por horário
2. Tap → sheet de substitutos (top 3, linguagem)
3. Persistir substituição (ou enviar pedido ao coach)
4. Check “comi” alimentando métricas reais (substituir o 85% fake)
5. Lista de compras / resumo como secundário

**Teste da premissa:** oferecer substitutos que desaparecem ensina o aluno a **não confiar** no app. Preferível menos opções estáveis a mais opções efêmeras.

---

## Pilares violados por ponto de contato

| Ponto | Pilares mais quebrados | Prática de navegação que corrige |
|-------|------------------------|----------------------------------|
| Shell | Simplicidade, Consistência | Bottom nav + Home com 1 tarefa |
| Check-in | Simplicidade, Feedback, Divulgação progressiva | Wizard (progressivo) + autosave + barra de progresso |
| Métricas | Simplicidade, Feedback (dados falsos) | Uma métrica-herói; drill-down |
| Coleman | Consistência de canais (gap) | Um Assistente em “Mais”; não novo silo |
| Treino | Divulgação progressiva invertida, Feedback | Sessão: essencial = exercício; PDF = secundário |
| Dieta | Feedback (troca some), Acessibilidade (layout) | Sheet + persistência + check “comi” |

---

## Ordem de ataque (por dependência, não por calendário)

Alinhada aos pilares: primeiro **consistência mobile + simplicidade do shell**; depois **divulgação progressiva + feedback** nos rituais diários/semanais; por último **novos canais** (Coleman).

| # | Iniciativa | Pilares que sobem | Desbloqueia |
|---|------------|-------------------|-------------|
| 1 | Shell mobile (bottom nav + Home Hoje) | Consistência, Simplicidade | Descoberta |
| 2 | Check-in wizard + autosave | Divulgação progressiva, Feedback | Adesão + dados |
| 3 | Treino modo sessão + Dieta do dia | Simplicidade, Feedback, Acessibilidade | Hábito |
| 4 | Progresso unificado (matar mocks) | Feedback verdadeiro, Simplicidade | Confiança |
| 5 | Coleman | Consistência de canais (se bem encaixado) | Dúvidas 24/7 |

---

## Critérios de sucesso (mensuráveis)

Sem baseline atual no repo — definir instrumentação junto com o shell:

1. **Time-to-task:** mediana de tempo do login até 1ª ação útil (treino / refeição / check-in)
2. **Check-in completion rate:** % que inicia vs envia; % que abandona no meio
3. **Session mode adoption:** % de treinos abertos que usam “Começar” vs só PDF
4. **Substitution persistence:** % de trocas que sobrevivem a um reload
5. **Confiança no dashboard:** zero métricas mock em produção

---

## O que esta análise não prova

- Não há heatmaps / funis neste repositório.
- Coleman pode existir fora deste código; aqui só afirmamos ausência no portal.
- Quotes de clientes devem recalibrar a ordem entre check-in vs treino vs dieta.

---

## Artefato interativo

Versão navegável por ponto de contato no Cursor Canvas da análise (mesmo conteúdo estruturado).

## Próximo artefato

Roadmap de execução (Design Excellence): [`ROADMAP_EXCELENCIA_ALUNO_MOBILE.md`](./ROADMAP_EXCELENCIA_ALUNO_MOBILE.md).
