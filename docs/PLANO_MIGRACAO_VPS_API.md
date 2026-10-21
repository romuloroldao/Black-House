# Plano: Postgres VPS + API própria (caminho B)

**Decisão:** abandonar dependência operacional do Supabase Cloud; banco na VPS + API HTTP própria.  
**Estado atual (fato):** o front ainda chama `@supabase/supabase-js` em dezenas de módulos (Auth, PostgREST, Realtime, Storage, Edge Functions).  
**Estado desejado:** browser → `https://api.seudominio/…` → Node na VPS → PostgreSQL local.

Este plano **não inventa** que a VPS já está ligada ao app. Sem `DB_*` e URL da API, a Fase 0 fica bloqueada.

---

## 1. Enunciado do problema

> Para operar Black House com controle e sem DNS/SaaS frágil, dependemos do pacote Supabase (Auth + API + Realtime + Storage + Functions), enquanto a infraestrutura alvo é Postgres na VPS. Precisamos migrar por fatias com aceite mensurável, sem big-bang.

---

## 2. O que NÃO fazer

| Não fazer | Por quê |
|-----------|---------|
| Apontar só a connection string e manter `supabase-js` | O client fala HTTP com PostgREST/Auth do Supabase, não com `pg` direto |
| Migrar tudo numa PR | Auth + chat realtime + storage + 50 telas = alto risco |
| Expor Postgres na internet sem API | Segurança; RLS atual assume JWT do Supabase |
| Manter Coleman só como Edge Function | Na VPS vira rota `/api/coleman` |
| Assumir que usuários Auth já existem em `app_auth.users` | Precisa importar/migrar senhas ou forçar reset |

---

## 3. Arquitetura alvo (MECE)

```
[React/Vite] 
    → HTTPS → [API Node (server/)] 
                  → PostgreSQL (VPS)
                  → Disco/MinIO (uploads)
                  → Lovable/OpenAI (Coleman, opcional)
    ← SSE/WebSocket (chat) ←
```

| Bloco | Responsável | Substitui |
|-------|-------------|-----------|
| `app_auth.*` | SQL + rotas `/auth/*` | `auth.users` Supabase |
| REST `/api/*` | Express/Fastify | `supabase.from()` |
| JWT próprio | API | sessão Supabase |
| Uploads `/api/uploads` | API + filesystem/S3 | Storage |
| Chat | SSE ou WS + tabela `mensagens` | Realtime |
| Jobs cron | systemd/cron na VPS | Edge schedulers |
| Coleman | `POST /api/coleman` | `coleman-assist` edge |

---

## 4. Fases (ordem por dependência)

### Fase 0 — Inventário e acesso

| Entrega | Aceite |
|---------|--------|
| Credenciais VPS: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `psql` conecta; `SELECT 1` |
| Dump ou schema atual alinhado | Tabelas `alunos`, `dietas`, etc. existem |
| Decisão de domínio API (`api.` / path `/api`) | Documentado |

**Bloqueio atual:** credenciais VPS não estão neste ambiente/agente.

### Fase 1 — Schema Auth + API mínima (scaffold neste repo)

| Entrega | Aceite |
|---------|--------|
| `server/sql/001_app_auth.sql` | Roda em Postgres limpo/com dump |
| `server/` com `/health`, `/auth/login`, `/auth/me` | Teste local com `.env` |
| `docs` + `.env.example` | Outro dev sobe sem adivinhar |

**Status:** entregue no repositório — `server/` (Express), `server/sql/001_app_auth.sql`, flag `VITE_USE_VPS_API` + `src/lib/apiClient.ts`.

### Fase 2 — Auth no front (feature flag)

| Entrega | Aceite |
|---------|--------|
| `VITE_API_URL` + client HTTP | Login aluno/coach via API |
| `AuthContext` dual (flag `VITE_USE_VPS_API=true`) | Mesmo fluxo `/auth` e `/aluno` |
| Migração de usuários (export + hash ou reset senha) | Usuário de teste loga |

### Fase 3 — Rotas do portal aluno (maior ROI mobile)

Ordem sugerida (espelha as ondas de UX já feitas):

1. `GET /api/me/aluno`  
2. Dieta + itens + PATCH substituição  
3. Treinos ativos  
4. Check-ins CRUD  
5. Progresso / fotos (upload)  
6. Relatórios  
7. Coleman  
8. Chat (pode ficar por último por causa do realtime)

**Aceite por rota:** tela correspondente no aluno **não** importa `supabase` para aquela feature.

### Fase 4 — Coach panel + pagamentos + jobs

- Painel coach (mais telas)  
- Asaas webhooks na VPS  
- Cron: lembretes check-in, expiração treino, cobranças  

### Fase 5 — Desligar Supabase

- Remover `@supabase/supabase-js`  
- Remover `src/integrations/supabase`  
- DNS/secrets cloud desativados  
- Backup final  

---

## 5. Critérios de sucesso do programa

1. Login aluno/coach **sem** `*.supabase.co`  
2. Portal `/aluno` (ondas 0–4) 100% via API VPS  
3. Uploads e chat funcionando sem Storage/Realtime Supabase  
4. Zero chamadas de rede a Supabase em produção (DevTools Network)  

**Fracasso a declarar cedo:** Fase 2 “pronta” mas senhas de alunos reais não migraram → reset em massa sem comunicação.

---

## 6. Riscos

| Risco | Mitigação |
|-------|-----------|
| Senhas Supabase Auth não são bcrypt exportáveis fácil | Fluxo “definir nova senha” / magic link próprio |
| RLS sumir | Autorização na API (`aluno.email === req.user.email`, `coach_id`) |
| Chat sem realtime | Polling curto na 1ª versão; WS depois |
| Downtime | Flag `VITE_USE_VPS_API`; rollback = flag off |
| Coleman sem key | Mesmo fallback: escalar para chat coach |

---

## 7. O que este repo entrega agora

- Plano (este doc)  
- Scaffold `server/` — `/health`, `/auth/*`, `/api/coleman`  
- SQL `server/sql/001_app_auth.sql`  
- Front: `VITE_USE_VPS_API` + `src/lib/apiClient.ts` (login Auth + Coleman)  
- Guia legado ainda válido: `GUIA_MIGRACAO_SERVIDOR.md` (detalhe operacional)

## 8. Próxima ação humana necessária

Enviar (em canal seguro, não no chat público se possível):

```
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
API_PUBLIC_URL=https://...
JWT_SECRET=
```

Com isso, a Fase 0 desbloqueia e validamos `/health` + `/auth/login` contra a VPS real.
