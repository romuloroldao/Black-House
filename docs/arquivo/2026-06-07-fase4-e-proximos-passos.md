# Fase 4 + próximos passos — 2026-06-07

**Roadmap:** `docs/arquivo/2026-06-07-roadmap-atualizado.md`

---

## BH-QA-006 · `/api/treinos` — ✅ implementado

Rotas semânticas em `server/routes/api.js`:

| Método | Rota | Quem |
|--------|------|------|
| GET | `/api/treinos` | coach (próprios), admin (todos) |
| GET | `/api/treinos/:id` | coach (próprio), admin, aluno (se atribuído em `alunos_treinos`) |
| POST | `/api/treinos` | coach |
| PATCH | `/api/treinos/:id` | coach (próprio) |
| DELETE | `/api/treinos/:id` | coach (próprio) |

O frontend já usa `/api/treinos`; deixa de depender só do mapeamento para `/rest/v1/treinos`.

**Verificação rápida:**
```bash
curl -s -H "Authorization: Bearer $TOKEN_COACH" https://api.blackhouse.app.br/api/treinos | head
curl -s -o /dev/null -w "%{http_code}" https://api.blackhouse.app.br/api/treinos  # sem token → 401
```

---

## BH-QA-002 · Reteste Ederlon (manual)

**Contexto:** upload de fotos no check-in falhava no telemóvel (pedido não chegava à API). Fixes já em produção: `getToken()` no upload, nginx 120s, mensagens de erro melhoradas.

**Perfil:** procurar na BD por nome/email «Ederlon» / «Barbosa».

**Roteiro (5 min):**
1. Hard refresh ou fechar/abrir browser no telemóvel
2. Login → tab Check-in
3. Peso + **2 fotos** (galeria ou câmara)
4. Preencher blocos → **Enviar check-in**
5. Confirmar toast de sucesso

**Se falhar, capturar:**
- Hora exacta (para cruzar logs PM2)
- Texto exacto do toast
- Wi‑Fi vs dados móveis
- Screenshot

**Logs:**
```bash
grep "USER_ID_EDERLON\|progress-photo\|/checkins" /root/.pm2/logs/blackhouse-api-out.log | tail -20
```

---

## BH-QA-002 · Christian Calhares (referência)

- Email: `calhareschristian5@gmail.com`
- Tentativa 01/jun 17:01 — **nenhum POST** upload/check-in nos logs (falha client-side)
- Fixes + mensagens deployados 07/jun; pedir mesmo roteiro de reteste acima

---

## Fase 4.5 · Auditoria a11y — parcial (07/jun)

### Já conforme
- Bottom nav: `aria-label` no `<nav>`, `aria-current="page"`, alvos ≥44px
- Menu mobile: `aria-label="Abrir menu de navegação"`
- Check-in fotos: `aria-label` em remover foto
- Dieta: toggle refeição com `aria-label`
- `prefers-reduced-motion` em animações do portal

### Melhorias aplicadas (07/jun)
- **Skip link** «Ir para o conteúdo» → `#student-main-content`
- **`main`** com `id`, `tabIndex={-1}`, `aria-live="polite"`
- **Slider autoestima** com `aria-label` explícito
- **Badge coach** no bottom nav: `aria-label` quando há mensagens novas

### Backlog a11y (não bloqueante)
- [ ] Contraste secundário em badges `text-[11px]` (validar com axe)
- [ ] `aria-describedby` nos blocos longos do check-in (secções)
- [ ] Anunciar erros de formulário com `role="alert"` no toast Sonner (global)

**Critério Fase 4.5:** sem regressões WCAG AA **críticas** no portal aluno — estado **🟡 quase fechado**.

---

## Fase 4.6 · Piloto com 5 alunos

**Objectivo:** feedback real pós-polish, incluindo check-in mobile.

| # | Aluno | Dispositivo | Check-in | Dieta | Treino | Notas |
|---|-------|-------------|----------|-------|--------|-------|
| 1 | Christian Calhares | Android | ☐ | ☐ | ☐ | Falhou 01/jun — reteste |
| 2 | Ederlon Barbosa | Mobile | ☐ | ☐ | ☐ | BH-QA-002 |
| 3 | _a definir_ | | ☐ | ☐ | ☐ | |
| 4 | _a definir_ | | ☐ | ☐ | ☐ | |
| 5 | _a definir_ | | ☐ | ☐ | ☐ | |

**Checklist base:** `docs/arquivo/2026-05-25-checklist-teste-aluno.md`

**Registo:** copiar tabela «Registo de feedback» do checklist; severidade Bloqueante / Major / Minor.

---

## Ordem sugerida (esta semana)

1. **BH-QA-002** — mensagem Ederlon + Christian para reteste (roteiro acima)
2. **BH-QA-006** — smoke `GET /api/treinos` em produção ✅
3. **Fase 4.6** — fechar 3 alunos adicionais no piloto
4. **Fase 4.5** — fechar itens backlog a11y se o piloto reportar focus/contraste
