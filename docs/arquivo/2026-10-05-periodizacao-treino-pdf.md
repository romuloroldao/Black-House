# Periodização de Treino (PDF) — espelho da Refeição Livre

Data: 2026-10-05

## Resumo

Categoria **Periodizações de Treino** na biblioteca educativa + vínculo na ficha `treinos` + card no portal do aluno. O coach sobe o PDF (ex.: Método Soviético exportado do HTML) em Conteúdos Educativos e puxa na caixa da ficha de treino.

## Base de dados

- Colunas em `public.treinos`: `periodizacao_ativa`, `periodizacao_observacao`, `periodizacao_content_id` (FK → `educational_contents`)
- Migration: `server/migrations/20261005_treino_periodizacao.sql`

## Frontend

- Coach: `WorkoutPeriodizacaoFields` em `WorkoutForm` (biblioteca de treinos)
- Aluno: `StudentPeriodizacaoCard` em `StudentWorkoutsView` → `/portal-aluno/guia/:contentId`

## Como o coach usa (Método Soviético)

1. Exportar o HTML do método para PDF (fora da plataforma).
2. Conteúdos Educativos → Novo → categoria **Periodizações de Treino** → tipo PDF → upload.
3. Treinos → criar/editar ficha → ativar **guia de periodização** → selecionar o PDF → salvar.
4. Atribuir o treino ao aluno; o aluno vê o card e abre o guia.

## Deploy

```bash
sudo -u postgres psql -d blackhouse_db -f server/migrations/20261005_treino_periodizacao.sql
# rebuild/restart API + frontend conforme o fluxo usual do ambiente
```
