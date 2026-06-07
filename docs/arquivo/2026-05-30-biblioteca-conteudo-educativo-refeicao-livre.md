# Biblioteca de Conteúdo Educativo + Refeição Livre

Data: 2026-05-30

## Resumo

Implementação da biblioteca reutilizável de conteúdos educativos (PDF, artigo, vídeo) no painel do coach, integração com dietas via secção **Refeição Livre**, e visualização mobile-first no portal do aluno.

## Base de dados

- Tabela `public.educational_contents`
- Colunas em `public.dietas`: `refeicao_livre_ativa`, `refeicao_livre_observacao`, `refeicao_livre_content_id` (FK)
- Migration: `server/migrations/20260530_educational_contents.sql`

## API

| Método | Rota |
|--------|------|
| GET | `/api/educational-contents` |
| GET | `/api/educational-contents/:id` |
| POST | `/api/educational-contents` |
| PUT | `/api/educational-contents/:id` |
| DELETE | `/api/educational-contents/:id` |
| POST | `/api/uploads/educational-pdf` |
| GET | `/api/uploads/storage/educational-contents/:coachId/:filename` |

RBAC: coach/admin CRUD; aluno lê conteúdo apenas se ligado à dieta activa com Refeição Livre activa.

## Frontend

- Coach: menu **Conteúdos Educativos** (`?tab=educational-contents`)
- Dieta: card **Refeição Livre** em `DietCreator`
- Aluno: card compacto em `/portal-aluno?tab=diet` + página dedicada `/portal-aluno/guia/:contentId`

## Deploy

```bash
cp server/migrations/20260530_educational_contents.sql /tmp/
sudo -u postgres psql -d blackhouse_db -f /tmp/20260530_educational_contents.sql
bash scripts/build-e-deploy.sh /root
pm2 restart blackhouse-api
```
