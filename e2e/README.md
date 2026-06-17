# E2E — Black House (Playwright)

Testes ponta a ponta do **portal do aluno** (mobile) e **painel do coach** (desktop).

## Estrutura

```
e2e/
├── playwright.config.ts      # Config (baseURL, projetos mobile/desktop)
├── .env.example              # Credenciais de teste (copiar para .env)
├── helpers/
│   └── auth.ts               # Login via API + seed do JWT no localStorage
├── pages/
│   ├── auth.page.ts
│   ├── student-portal.page.ts
│   └── coach-portal.page.ts
└── tests/
    ├── auth/
    │   └── login-ui.spec.ts
    ├── student/
    │   ├── portal-navigation.spec.ts
    │   ├── checkin.spec.ts
    │   └── diet-scroll.spec.ts
    └── coach/
        └── dashboard.spec.ts
```

## Pré-requisitos

1. **API** a correr em `http://127.0.0.1:3001` (PM2 ou `node server/index.js`)
2. **Frontend** — o Playwright sobe o Vite automaticamente, ou use `E2E_SKIP_WEBSERVER=1` se já tiver `npm run dev`
3. **Contas de teste** com e-mail confirmado:
   - Aluno → `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD`
   - Coach → `E2E_COACH_EMAIL` / `E2E_COACH_PASSWORD`

```bash
cp e2e/.env.example e2e/.env
# Edite e2e/.env com credenciais reais
```

## Comandos

```bash
# Todos os testes E2E
npm run test:e2e

# Só autenticação (UI)
npm run test:e2e:auth

# Só portal do aluno (Pixel 7)
npm run test:e2e:student

# Só painel coach (desktop)
npm run test:e2e:coach

# UI interativa
npm run test:e2e:ui

# Relatório HTML
npm run test:e2e:report
```

## Fluxos cobertos

| Projeto | Spec | O que valida |
|---------|------|----------------|
| `auth-desktop` | `login-ui.spec.ts` | Login UI, RBAC, credenciais inválidas, esqueci senha |
| `student-mobile` | `portal-navigation.spec.ts` | Login → Hoje → Dieta → Treino → Coach (bottom nav) |
| `student-mobile` | `checkin.spec.ts` | Aba check-in semanal (formulário ou já enviado) |
| `student-mobile` | `diet-scroll.spec.ts` | Scroll na Dieta sem bottom nav tapar conteúdo |
| `coach-desktop` | `dashboard.spec.ts` | Dashboard → Alunos → Nutrição |

Sem credenciais em `e2e/.env`, os testes são **ignorados** (skipped), não falham.
