# Remoção PostgreSQL 12 — análise de impacto e execução

**Data:** 2026-06-14  
**Decisão:** Remover cluster PG12 após validação de que produção está no PG15.

## Análise de impacto (pré-remoção)

| Critério | PG 12 | PG 15 (produção) | Risco de remoção |
|----------|-------|------------------|------------------|
| Status | down, masked | online porta 5432 | Baixo |
| `app_auth.users` | 0 | 49 | Nenhum — dados reais no 15 |
| `public.alunos` | inexistente | 45 | Nenhum |
| Tabelas `public` | 1 (`user_roles`) | 48 | Nenhum |
| Backup recente | N/A | `backup_20260612_020001.sql.gz` (PG15) | Cobertura OK |
| API / health | — | `status: ok`, schema válido | OK |
| Referências em código | nenhuma hardcoded | `DB_PORT=5432` | OK |
| Scripts ops | watchdog → PG15 | setup-ops atualizado | OK |
| Disco | 49 MB | 68 MB | Libera ~49 MB + configs |

**Conclusão:** Remover PG12 **não afeta produção** — era cluster residual da instalação inicial (08/01), substituído pelo PG15 (10/01) com dados reais.

## O que foi executado

1. **Arquivo de segurança:** `/var/backups/postgresql/pg12-cluster-archive-20260614_234227.tar.gz` (5,6 MB)
2. **`pg_dropcluster 12 main`** — dados e config do cluster removidos
3. **`apt purge postgresql-12 postgresql-client-12`**

## Estado pós-remoção

```
pg_lsclusters → apenas 15/main porta 5432 online
app_auth.users → 49
/health → ok
Login → responde corretamente (senha incorreta vs usuário inexistente)
```

## Nota sobre pacotes

O `apt` instalou **postgresql-17** como dependência do metapacote `postgresql` (substituiu o meta que apontava para v12). **Nenhum cluster PG17 foi criado** — apenas binários no disco, sem impacto operacional. Opcional remover depois: `apt remove postgresql-17 postgresql-client-17`.

## Prevenção

- Único cluster em produção: **postgresql@15-main**
- Boot: `systemctl is-enabled postgresql@15-main` → enabled
- Não reinstalar `postgresql-12` neste servidor
