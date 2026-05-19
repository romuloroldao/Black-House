# Cenários de cadastro e vínculo aluno ↔ plataforma

Referência operacional alinhada a `docs/ARQUITETURA-ATUAL.md`. Última revisão: 2026-03-30.

---

## Cenário 1 — Já é aluno Black House e ainda não tem cadastro na plataforma

**Objectivo:** ter credencial (login) e, ao mesmo tempo, preservar o histórico coach–aluno que já existia fora do portal (ficha importada ou criada pelo coach).

### Passos (o tempo pode sobrepor-se)

| Quem | O quê |
|------|--------|
| **Aluno** | Cria cadastro na plataforma (formulário de registo: email, senha, nome, etc.). |
| **Coach** | Em paralelo, faz upload/importação da ficha do aluno para manter tratativas e histórico na estrutura do sistema (`public.alunos`, conversas, etc.). |
| **Sistema** | No signup cria a credencial e prepara confirmação por email. Mesmo com o email a coincidir, o sistema **só vincula** após confirmação do email (tokens em `app_auth.email_confirm_tokens`). |
| **Coach** | Se o vínculo automático não ocorrer (emails diferentes, ordem dos passos, ou política interna), o coach **unifica manualmente** em «Vínculos» / `POST /api/alunos/link-user` (`importedAlunoId` + `userIdToLink`). |

### Confirmação por email antes do vínculo (regra de negócio desejada)

Se a política for: *só depois do aluno confirmar o email é que o coach pode vincular*, isso implica:

- **Envio** de email com link de confirmação e **gravação** de `email_confirmed_at` (ou equivalente) em `app_auth.users`.
- **Regra no backend:** por exemplo, `POST /api/alunos/link-user` só aceitar utilizadores com email confirmado (e opcionalmente o coach só vê o aluno como “pronto para vínculo” nesse estado).

**Estado actual do código:** implementado. O backend gera token de confirmação no signup e bloqueia `POST /api/alunos/link-user` até `app_auth.users.email_confirmed_at` estar preenchido. A auto-vinculação no signup só acontece quando o email já estiver confirmado.

---

## Cenário 2 — Aluno completamente novo (sem ficha prévia a importar)

**Objectivo:** toda a ficha e o percurso nascem dentro da estrutura do sistema (sem PDF/histórico externo obrigatório).

### Passos típicos

| Quem | O quê |
|------|--------|
| **Coach** | Cria o registo do aluno em `public.alunos` (API `POST /api/alunos` autenticado como coach) **ou** usa fluxos de criação/importação que já existem no produto. |
| **Aluno** | Cria a credencial (signup) quando for dar acesso ao portal. |
| **Vínculo** | Igual ao cenário 1: **email igual** → possível vínculo automático no signup **após** confirmação do email; caso contrário → vínculo manual pelo coach. |

**Importante:** uma credencial **sem** linha em `alunos` com `user_id` / `linked_user_id` resolvido **não** acede às rotas de domínio do aluno (`/api/alunos/me`, etc.) até existir ficha e vínculo — por desenho de segurança (`resolveAlunoOrFail`).

---

## Resumo

| | Cenário 1 (histórico prévio) | Cenário 2 (novo) |
|--|------------------------------|------------------|
| Ficha | Importada/criada pelo coach em paralelo ou antes | Criada pelo coach no sistema |
| Credencial | Aluno regista-se no portal | Idem |
| Unificação | Auto por email **após confirmação** ou manual pelo coach | Idem |
| Confirmação email | Implementada via token + `email_confirmed_at` | Idem |

---

## Rotas / artefactos úteis (desenvolvimento)

- Registo: `POST /auth/signup` (`server/index.js`).
- Vínculo manual (coach): `POST /api/alunos/link-user` (`server/routes/api.js`).
- UI coach: `src/components/UserLinkingManager.tsx`.
