# Black House API (caminho B)

API Node + Postgres na VPS. Substitui Auth/PostgREST/Edge do Supabase Cloud por fatias.

## Subir local

```bash
cd server
cp .env.example .env
# preencha DB_* e JWT_SECRET
npm install
npm run dev
```

Smoke:

```bash
curl -s http://127.0.0.1:3001/health | jq
```

## Schema Auth

```bash
psql "$DATABASE_URL" -f sql/001_app_auth.sql
```

## Rotas Fase 1

| Método | Rota | Auth |
|--------|------|------|
| GET | `/health` | — |
| POST | `/auth/signup` | — |
| POST | `/auth/login` | — |
| GET | `/auth/me` | Bearer |
| POST | `/auth/logout` | Bearer |
| POST | `/api/coleman` | Bearer |

## Front

No app Vite, ative:

```
VITE_USE_VPS_API=true
VITE_API_URL=http://localhost:3001
```

Ver `docs/PLANO_MIGRACAO_VPS_API.md`.
