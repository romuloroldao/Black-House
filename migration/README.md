# Scripts de Migração

Este diretório contém os scripts SQL necessários para migrar do Supabase para PostgreSQL puro.

## Arquivos

- `migration_postgres.sql` - Script principal de migração que cria:
  - Schema `app_auth` com tabelas de usuários e sessões
  - Funções de autenticação (hash, login, validação)
  - Tabelas públicas adaptadas
  - Triggers e funções auxiliares

## Como Usar

### 1. Exportar dados do Supabase

```bash
./scripts/export-supabase.sh
```

### 2. Adaptar schema exportado

```bash
./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
```

### 3. Executar migração

```bash
psql -U app_user -d blackhouse_db -f migration/migration_postgres.sql
```

### 4. Importar schema adaptado

```bash
psql -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql
```

### 5. Importar dados

```bash
psql -U app_user -d blackhouse_db -f backup/data.sql
```

## Notas Importantes

1. **Backup**: Sempre faça backup antes de executar migrações
2. **Revisão**: Revise os scripts adaptados antes de importar
3. **Referências**: Certifique-se de que todas as referências a `auth.users` foram substituídas por `app_auth.users`
4. **Foreign Keys**: Verifique se todas as foreign keys estão corretas após a adaptação

## Troubleshooting

### Erro: "relation does not exist"
- Verifique se o schema `app_auth` foi criado
- Confirme que as extensões foram instaladas

### Erro: "permission denied"
- Verifique se o usuário tem permissões no banco
- Confirme que o usuário é owner do banco de dados

### Erro: "duplicate key"
- Pode haver dados duplicados no export
- Revise os dados antes de importar
