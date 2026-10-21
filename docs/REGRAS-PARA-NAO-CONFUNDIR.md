# Regras para não confundir (equipa + IA)

## 1. Uma única “fonte da verdade” do sistema

| O quê | Onde |
|--------|------|
| Stack, env, SQL canónico, o que **não** é Supabase | [`ARQUITETURA-ATUAL.md`](ARQUITETURA-ATUAL.md) |
| O que cada `.md` antigo vale | [`INVENTARIO-MD.md`](INVENTARIO-MD.md) |
| Este guia de hábitos | Este ficheiro |

**Regra:** Se alguém (ou a IA) tiver dúvida “como é que isto funciona?”, a resposta deve bater com `ARQUITETURA-ATUAL.md` ou com o **código**. Se o doc estiver errado, **corrige o doc** no mesmo raciocínio em que mudas o código.

---

## 2. Onde editar código

- **Só a raiz do repositório** onde está o `package.json` do frontend (e a pasta `server/` ao lado).
- **Não** usar `.worktrees/checkpoint/` (ou cópias paralelas) como sítio de trabalho — é arquivo/duplicado e desactualiza rápido.

---

## 3. Novos ficheiros de texto (`.md`)

- **Evitar** espalhar relatórios na raiz (`STATUS_X.md`, `FIX_Y.md`).
- Se precisares de nota pontual: pasta **`docs/arquivo/`** com nome com data, por exemplo `docs/arquivo/2026-03-30-ajuste-dns.md`.
- **Não** duplicar o mesmo conteúdo em dois sítios; um link basta.

---

## 4. README na raiz

- Deve ser **curto**: o que é o projeto, como instalar/arrancar, e **links** para `docs/ARQUITETURA-ATUAL.md` e `docs/REGRAS-PARA-NAO-CONFUNDIR.md`.
- Texto longo e histórico fica em `docs/`, não no `README.md`.

---

## 5. Variáveis e URLs

- Frontend: **só** `VITE_*` no `.env` da raiz.
- API: **só** segredos e `DB_*` em `server/.env`.
- Manter **a mesma URL base** da API no browser e na documentação (ex.: `http://localhost:3001` em dev).

---

## 6. Schema da base de dados

- Alterações estruturais: primeiro **`schema_adaptado_postgres.sql`** (e o fluxo `npm run db:migrate`), depois actualizar **`ARQUITETURA-ATUAL.md`** se mudar algo conceptual (novo serviço, nova camada).

---

## 7. Pedidos à IA (Cursor, etc.)

- Indicar sempre: “segue `docs/ARQUITETURA-ATUAL.md` e não assumes Supabase”.
- Se a IA propor novo `.md` na raiz, pedir para colocar em **`docs/`** ou **`docs/arquivo/`**.

---

Resumo numa frase: **código + `docs/ARQUITETURA-ATUAL.md` mandam; cópias paralelas e notas soltas na raiz não.**
