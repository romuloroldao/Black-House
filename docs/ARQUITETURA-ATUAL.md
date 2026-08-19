# Arquitetura atual (referência canónica)

Última revisão: documentação alinhada ao código em `main` do repositório (não à pasta `.worktrees/checkpoint`). Ponteiro Phase 7a: 2026-08-19.

## Visão geral

| Camada | Tecnologia | Pasta / entrada |
|--------|------------|------------------|
| Frontend | React 18 + Vite 5 + TypeScript + React Router | Raiz: `package.json`, `vite.config.ts`, `src/` |
| Backend | Node.js + Express + Socket.io | `server/index.js` |
| Base de dados | PostgreSQL (sem Supabase em runtime) | Schema aplicado via `schema_adaptado_postgres.sql` (`npm run db:migrate` / `server/runMigrations.js`) |
| Autenticação | JWT + `app_auth.users` (funções SQL no schema) | Rotas `/auth/*` no `server/index.js` |

## Variáveis de ambiente

- **Frontend:** `.env` na raiz — `VITE_API_URL` (e opcionalmente `VITE_API_BASE_URL`).
- **API:** `server/.env` — `JWT_SECRET`, `DB_*`, `PORT`, `API_URL`, etc. Carrega primeiro `.env` da raiz, depois `server/.env` (sobrescreve).

## Contrato HTTP

- Rotas semânticas `/api/*` e `apiClient` em `src/lib/api-client.ts`.
- Lista de pathnames permitidos pelo cliente (alinhada ao Express): `src/contracts/api-contract.ts` (`API_CONTRACT`, `isContractEndpoint`). Não incluir rotas fantasma: o contrato deve refletir o que o servidor expõe.
- Supabase/PostgREST foi removido do fluxo principal; existe “kill switch” em `src/lib/supabase.ts` para evitar regressão.

## Ficheiros SQL

- **Canónico para criar/atualizar estrutura:** `schema_adaptado_postgres.sql` (via `runMigrations.js`).
- `schema.sql` na raiz e `migration/migration_postgres.sql` são **históricos / migração**; não substituem o canónico sem revisão.

## WebSocket

- Socket.io no mesmo processo HTTP, path `/socket.io`, autenticação por JWT no handshake (`server/services/websocket.service.js`).

## O que **não** fazer

- Não configurar `anon` / `service_role` do Supabase para este projeto atual.
- Não assumir que `README.md` na raiz (antigo, ver inventário) descreve o modelo de dados em produção.

## Onboarding aluno (dois cenários)

- Aluno com histórico/ficha importada **vs** aluno novo; credencial, vínculo automático por email e vínculo manual pelo coach: ver [`arquivo/2026-03-30-cenarios-cadastro-aluno.md`](arquivo/2026-03-30-cenarios-cadastro-aluno.md).

## Agentic OS (portal aluno)

Documentação de investigação e specs:

- Auditoria: [`arquivo/2026-07-26-auditoria-agentic-os.md`](arquivo/2026-07-26-auditoria-agentic-os.md)
- PRD complementar: [`arquivo/2026-07-26-prd-blackhouse-agentic-os.md`](arquivo/2026-07-26-prd-blackhouse-agentic-os.md)
- Specs: Phase 1a–6 (`docs/arquivo/`, prefixo `2026-07-26-spec-phase-*`); Phase 7 HITL: [`arquivo/2026-08-19-spec-phase-7-coach-agent-hitl.md`](arquivo/2026-08-19-spec-phase-7-coach-agent-hitl.md)
- PRD as-built de recursos: [`arquivo/2026-07-25-prd-blackhouse-recursos.md`](arquivo/2026-07-25-prd-blackhouse-recursos.md)

**Estado de implementação (2026-08-19):** Phase 1a–6 + Agent-First + respostas progressivas + receitas com web + **Phase 7a Coach Agent HITL** (carteira 7d, método/`coach_rules`, sessão de treino no servidor, inbox determinística, rascunhos HITL). **Layout adaptativo:** sidebar aluno compacta (só ícones, default) / expandida; ver [`arquivo/2026-07-28-layout-adaptativo-nav.md`](arquivo/2026-07-28-layout-adaptativo-nav.md). Flag: `VITE_AGENT_DAILY_ENABLED`. **Fora deste ciclo (7b):** orquestrador LLM do coach.

---

**Como trabalhar sem confundir:** [`REGRAS-PARA-NAO-CONFUNDIR.md`](REGRAS-PARA-NAO-CONFUNDIR.md)
