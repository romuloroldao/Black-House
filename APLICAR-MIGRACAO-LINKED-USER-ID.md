# Como Aplicar a Migração: linked_user_id

## ⚠️ STATUS ATUAL

O sistema está em **MODO DEGRADED** porque a coluna `linked_user_id` não existe na tabela `public.alunos`.

**Sintomas:**
- Todas as requisições `/rest/v1/*` retornam 503 Service Unavailable
- Mensagem de erro: "Sistema em manutenção. O schema do banco de dados precisa ser atualizado."
- Frontend exibe erro ao tentar carregar dados

**Causa:**
- Migração SQL não foi aplicada no banco conectado pelo backend
- Banco conectado: `blackhouse_db` (localhost:5432)
- Schema: `public`

## 🔧 AÇÃO NECESSÁRIA

Aplicar a migração SQL no banco conectado pelo backend.

## 📄 ARQUIVO DE MIGRAÇÃO

```
/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

## 📝 MÉTODOS DE APLICAÇÃO

### Método 1: Via Supabase Dashboard (Recomendado)

1. Acessar o Supabase Dashboard
2. Navegar para **SQL Editor**
3. Criar nova query
4. Copiar todo o conteúdo do arquivo de migração
5. Executar a query como **superuser/owner**
6. Verificar que a query foi executada com sucesso

### Método 2: Via psql (Linha de Comando)

```bash
# Conectar ao banco como superuser
psql -h localhost -p 5432 -U postgres -d blackhouse_db

# Executar migração
\i /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql

# Ou executar diretamente:
psql -h localhost -p 5432 -U postgres -d blackhouse_db -f /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

### Método 3: Via Docker/Container PostgreSQL

Se o PostgreSQL estiver rodando em container:

```bash
# Copiar arquivo para o container
docker cp /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql <container_name>:/tmp/

# Executar dentro do container
docker exec -i <container_name> psql -U postgres -d blackhouse_db -f /tmp/20260116143000_add_linked_user_id_to_alunos.sql
```

## ✅ VERIFICAÇÃO PÓS-MIGRAÇÃO

Após aplicar a migração, verificar:

```sql
-- 1. Verificar identidade do banco (deve retornar: blackhouse_db, public)
SELECT current_database(), current_schema();

-- 2. Verificar existência da coluna (deve retornar 1 row)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'linked_user_id';

-- 3. Verificar foreign key (deve retornar 1 row)
SELECT conname, confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE conrelid = 'public.alunos'::regclass
  AND conname = 'alunos_linked_user_id_fkey';

-- 4. Verificar índice (deve retornar 1 row)
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'alunos'
  AND indexname = 'idx_alunos_linked_user_id';
```

## 🔄 REINICIAR BACKEND

Após aplicar a migração com sucesso:

```bash
# Reiniciar backend para revalidar schema
pm2 restart blackhouse-api

# Verificar logs
pm2 logs blackhouse-api --lines 20

# Verificar health check
curl https://api.blackhouse.app.br/health | jq '.'
```

**Resultado esperado após migração:**
```json
{
  "status": "ok",
  "schema": {
    "valid": true
  }
}
```

## 📋 CONTEÚDO DA MIGRAÇÃO

A migração:
- ✅ Adiciona coluna `linked_user_id UUID NULL` se não existir
- ✅ Cria foreign key para `app_auth.users(id)`
- ✅ Define `ON DELETE SET NULL` (preserva registros de alunos)
- ✅ Define `ON UPDATE CASCADE` (atualiza automaticamente)
- ✅ Cria índice `idx_alunos_linked_user_id` para performance
- ✅ Adiciona comentário SQL documentando o campo
- ✅ Atualiza registros existentes baseados em email (opcional)

**A migração é idempotente** - pode ser executada múltiplas vezes sem erro.

## 🆘 TROUBLESHOOTING

### Erro: "must be owner of table alunos"

**Causa:** Usuário não tem privilégios suficientes.

**Solução:**
- Aplicar migração como superuser (postgres) ou owner da tabela
- Ou conceder privilégios: `GRANT ALL ON public.alunos TO app_user;`

### Erro: "relation app_auth.users does not exist"

**Causa:** Schema `app_auth` não existe ou tabela `users` não existe.

**Solução:**
- Verificar se o schema `app_auth` existe: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app_auth';`
- Verificar se a tabela `users` existe: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'app_auth' AND table_name = 'users';`

### Migração aplicada mas backend ainda retorna 503

**Causa:** Backend ainda não reiniciou ou está conectado a banco diferente.

**Solução:**
1. Verificar logs: `pm2 logs blackhouse-api | grep "db.identity"`
2. Confirmar que backend está conectado ao banco correto
3. Reiniciar backend: `pm2 restart blackhouse-api`

## 📚 DOCUMENTAÇÃO RELACIONADA

- **Design completo**: `/root/DESIGN-LINKED-USER-ID.md`
- **Documentação urgente**: `/root/SCHEMA-LINKED-USER-ID-URGENT.md`
- **Código do validador**: `/root/server/utils/schema-validator.js`
- **Código de identidade do banco**: `/root/server/utils/db-identity.js`

