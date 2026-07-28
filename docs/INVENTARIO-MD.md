# Inventário de ficheiros `.md` (projeto Black House)

**Última auditoria:** 2026-05-19 (índice agentic actualizado 2026-07-26)  
**Limpeza aplicada:** os `.md` soltos da raiz foram arquivados em `docs/arquivo/legado-md-2026-05-19/`; a raiz ficou apenas com `README.md`.
**Hábitos:** [`REGRAS-PARA-NAO-CONFUNDIR.md`](REGRAS-PARA-NAO-CONFUNDIR.md) · **Arquitetura:** [`ARQUITETURA-ATUAL.md`](ARQUITETURA-ATUAL.md)

Legenda: **Válido** · **Parcial** (rever trechos) · **Obsoleto** (não usar para implementar) · **Arquivo** (histórico datado) · **Ferramenta** (não é doc da app) · **Ignorar** (fora do repo da app)

---

## Resumo numérico (repo da app, sem IDE/node_modules/.worktrees)

| Categoria | ~Qtd | Acção sugerida |
|-----------|------|----------------|
| **Canónico** (`docs/` vivo) | 3 | Manter |
| **Arquivo datado** (`docs/arquivo/`) | 3+ | Manter; novos relatórios só aqui |
| **Legado arquivado** (`docs/arquivo/legado-md-2026-05-19/`) | **237** | Não usar como guia de implementação |
| **Raiz** | **1** | Apenas `README.md` mínimo |
| **Parcial** (actualizar) | 4 | Editar ou arquivar |
| **Ferramenta** | 1 | Manter se usas skills |
| **`.worktrees/checkpoint/`** | **~262** | **Ignorar** (cópia antiga) |

---

## Manter como referência viva

| Ficheiro | Estado | Porquê |
|----------|--------|--------|
| `docs/ARQUITETURA-ATUAL.md` | **Válido** | Stack actual: Vite, Express, PostgreSQL, JWT |
| `docs/REGRAS-PARA-NAO-CONFUNDIR.md` | **Válido** | Hábitos de trabalho |
| `docs/INVENTARIO-MD.md` | **Válido** | Este ficheiro |
| `README.md` | **Válido** | Entrada mínima com links para `docs/` |
| `docs/arquivo/*.md` | **Arquivo** | Notas com data (equivalência, nutrição, cadastro aluno) |
| `docs/arquivo/2026-07-25-prd-blackhouse-recursos.md` | **Válido (as-built)** | Inventário/PRD do produto actual |
| `docs/arquivo/2026-07-26-auditoria-agentic-os.md` | **Válido (visão)** | Auditoria transformação agentic — ainda não runtime |
| `docs/arquivo/2026-07-26-prd-blackhouse-agentic-os.md` | **Válido (visão)** | PRD complementar Agentic OS |
| `docs/arquivo/2026-07-26-spec-phase-1a-execucao-diaria.md` | **Válido (spec)** | Persistência execução diária |
| `docs/arquivo/2026-07-26-spec-phase-1b-agent-foundation.md` | **Válido (spec)** | Foundation do orquestrador/tools |
| `docs/arquivo/2026-07-26-spec-phase-2-daily-agent.md` | **Válido (spec)** | MVP Daily Agent |
| `docs/arquivo/2026-07-26-spec-phase-3-guided-workout.md` | **Válido (spec)** | Guided Workout série a série |
| `docs/arquivo/2026-07-26-spec-phase-4-contextual-nutrition.md` | **Válido (spec)** | Substituições diárias + restaurante→foto |
| `docs/arquivo/2026-07-26-spec-phase-5-behavioral-intelligence.md` | **Válido (spec)** | Insight + missed meal/workout |
| `docs/arquivo/2026-07-26-spec-phase-6-coach-knowledge.md` | **Válido (spec)** | coach_rules no Daily Agent |
| `docs/arquivo/legado-md-2026-05-19/` | **Arquivo legado** | Antigos relatórios da raiz |
| `server/EVENTOS_WEBSOCKET.md` | **Parcial** | Eventos Socket.io; ajustar URLs de exemplo |
| `src/scripts/README-IMPORT-TACO.md` | **Parcial** | Import TACO; **remover** troubleshooting Supabase |
| `public/templates/INSTRUCOES-IMPORTACAO.md` | **Válido** | Template CSV alimentos |
| `migration/README.md` | **Arquivo** | Histórico migração; bootstrap actual é `schema_adaptado_postgres.sql` |

---

## Obsoleto — não seguir para desenvolvimento

### 1. `README.md` antigo (raiz)

Foi substituído por um README mínimo. A versão antiga descrevia Supabase Auth, `auth.users`, RLS e `DOCUMENTACAO.md` inexistente.

### 2. Relatórios pontuais na raiz (~162 ficheiros)

Padrões de nome: `*-IMPLEMENTADO.md`, `DEPLOY-*`, `DESIGN-*`, `DEBUG_*`, `REACT-*-FIX-*`, `CORRECAO_*`, `STATUS_*`, `RESUMO_*`, `CONFIGURACAO_*_CONCLUIDA`, `CHECKLIST_*` antigo.

**Natureza:** instantâneo de um incidente/deploy (jan–mai 2026). O código em `server/` e `src/` é a verdade.

**Exemplos arquivados:** `AUTH-502-BAD-GATEWAY-FIX-001-IMPLEMENTADO.md`, `CORS-SINGLE-SOURCE-OF-TRUTH-001-IMPLEMENTADO.md`, `DEPLOY-FIX-008-CONCLUIDO.md`, `DESIGN-ROOT-RENDER-UNBLOCK-001.md`, todos os `REACT-*-FIX-*`.

### 3. Migração / purge Supabase (~36 ficheiros)

Conteúdo ou título centrado em Supabase/PostgREST/RLS já removidos do runtime.

**Exemplos arquivados:** `ARQUIVOS_PENDENTES_MIGRACAO_SUPABASE.md`, `REMOCAO_SUPABASE_IMPORTACAO.md`, `VERIFICACAO_FINAL_SUPABASE.md`, `DESIGN-SUPABASE-PURGE-*`, `CORRECAO_SUPABASE_FRONTEND.md`, `DECISAO_SCRIPTS_SUPABASE.md`, `APLICAR-MIGRACAO-LINKED-USER-ID.md`.

### 4. Nutrição / schema desactualizados

| Ficheiro | Problema |
|----------|----------|
| `RELATORIO_VERIFICACAO_NUTRICAO.md` | Auditoria **2025-11**; pré-equivalência isocalórica e grupos logicaTabela |
| `ANALISE_NUTRICIONAL.md` | Links ao dashboard Supabase; fluxo antigo |
| `CORRECOES_SCHEMA_APLICADAS.md` | Snapshot **2026-01-12**; `perfil_nutricional` etc. — ver `schema_adaptado_postgres.sql` |
| `SCHEMA-*.md` na raiz | Notas pontuais; canónico é `schema_adaptado_postgres.sql` |
| `STATUS_SCHEMA.md`, `VERIFICACAO_SCHEMA_CORRIGIDO.md` | Status antigo |

**Substituto:** `docs/arquivo/2026-05-19-equivalencia-alimentar.md` + código `food-equivalence` / `foodEquivalence.ts`.

### 5. Infra legada Supabase

| Ficheiro | Problema |
|----------|----------|
| `configuracao_storage.md` | Buckets Supabase Storage |
| `diagrama_relacionamentos.md` | Diagrama com `auth.users` Supabase |

### 6. DNS / deploy / VPS (arquivo operacional)

Ainda podem ter valor **histórico** se o domínio não mudou: `CONFIGURAR_DNS_REGISTRO_BR.md`, `STATUS_DNS.md`, `SSL_CONFIGURADO.md`, `DEPLOY_PRODUCAO_FINAL.md`, etc. Agora estão em `docs/arquivo/legado-md-2026-05-19/`.

### 7. `.worktrees/checkpoint/` (~262 `.md`)

Cópia paralela antiga + duplicados dos relatórios da raiz. **Não editar nem consultar** para implementação (ver `.gitignore` / regras do projeto).

---

## Arquivo legado — lista dos que **ainda podem** ter utilidade

```
docs/arquivo/legado-md-2026-05-19/AI_PROVIDER_GUIDE.md
docs/arquivo/legado-md-2026-05-19/ARQUITETURA_IMPORTACAO_PDF.md
docs/arquivo/legado-md-2026-05-19/COMO_CONFIGURAR_IA.md
docs/arquivo/legado-md-2026-05-19/COMO_IMPORTAR_SIMPLES.md
docs/arquivo/legado-md-2026-05-19/ESPECIFICACAO_IMPORTACAO_IMPLEMENTADA.md
docs/arquivo/legado-md-2026-05-19/README_IMPORTACAO.md
docs/arquivo/legado-md-2026-05-19/TROUBLESHOOTING.md
```

A raiz agora deve continuar sem relatórios soltos; novos documentos vão para `docs/` ou `docs/arquivo/`.

---

## Pastas a ignorar na auditoria da app

- `.agents/`, `.cursor/skills-cursor/`, `.gemini/`, `.antigravity-server/`, `.cursor-server/`
- `node_modules/`, `dist/`
- `.worktrees/`

---

## Plano de limpeza aplicado

1. Arquivar 237 `.md` da raiz em `docs/arquivo/legado-md-2026-05-19/`.
2. Reescrever `README.md` como entrada mínima.
3. Manter `docs/ARQUITETURA-ATUAL.md` como fonte principal.
4. Em revisão futura, actualizar `server/EVENTOS_WEBSOCKET.md` e `src/scripts/README-IMPORT-TACO.md`.

---

## Ficheiro que tens aberto agora

**`CORRECOES_SCHEMA_APLICADAS.md`** — **Obsoleto como guia de trabalho.** Foi arquivado em `docs/arquivo/legado-md-2026-05-19/CORRECOES_SCHEMA_APLICADAS.md`. Para schema actual usa `schema_adaptado_postgres.sql` e migrações em `server/migrations/`.
