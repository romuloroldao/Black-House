# Design: Vínculo Aluno ↔ Usuário (linked_user_id)

## Visão Geral

O campo `linked_user_id` na tabela `public.alunos` estabelece uma relação explícita e unidirecional entre alunos importados e credenciais de usuário autenticadas (`app_auth.users`).

## Especificação Técnica

### Tabela e Coluna

- **Tabela**: `public.alunos`
- **Coluna**: `linked_user_id`
- **Tipo**: `UUID NULL`
- **Constraint**: `FOREIGN KEY (linked_user_id) REFERENCES app_auth.users(id)`
- **Index**: `idx_alunos_linked_user_id` (para performance em buscas)

### Semântica

| Valor | Significado |
|-------|-------------|
| `NULL` | Aluno importado ainda não vinculado a nenhuma credencial de usuário |
| `NOT NULL` | Aluno vinculado a uma credencial ativa (usuário pode fazer login) |

### Constraints e Comportamento

- **`ON DELETE SET NULL`**: Quando um usuário é deletado de `app_auth.users`, o `linked_user_id` do aluno correspondente é automaticamente definido como `NULL`. Isso preserva o registro do aluno e permite re-vinculação futura.
- **`ON UPDATE CASCADE`**: Se o `id` do usuário em `app_auth.users` for alterado (cenário raro), o `linked_user_id` é automaticamente atualizado.

### Unicidade

**Decisão**: `linked_user_id` **NÃO** possui constraint `UNIQUE`.

**Justificativa**:
- Permite flexibilidade para casos edge (mesmo usuário vinculado a múltiplos alunos importados, se necessário no futuro)
- Não há requisito de negócio que exija um aluno por usuário
- A aplicação deve validar logicamente se necessário

### Fonte de Verdade

**`linked_user_id` é a única fonte de verdade para determinar vínculo aluno ↔ usuário.**

- Não usar email ou outros campos derivados para determinar vínculo
- Não usar status string ou flags visuais como fonte de verdade
- UI deve consultar `linked_user_id IS NULL` ou `linked_user_id IS NOT NULL`

## Migração SQL

**Arquivo**: `/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql`

### Características da Migração

1. **Idempotente**: Pode ser executada múltiplas vezes sem erro
   - Usa `IF NOT EXISTS` para coluna
   - Usa `DROP CONSTRAINT IF EXISTS` antes de criar FK
   - Usa `CREATE INDEX IF NOT EXISTS` para índice

2. **Segura**: Não altera dados existentes de forma destrutiva
   - `UPDATE` opcional para inferir vínculos existentes baseados em email
   - `ON DELETE SET NULL` preserva registros de alunos

3. **Documentada**: Comentários SQL explicam propósito e comportamento

### Validação Pós-Migração

Após aplicar a migração, validar:

```sql
-- 1. Verificar identidade do banco
SELECT current_database(), current_schema();

-- 2. Verificar existência da coluna
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'linked_user_id';
-- RESULTADO ESPERADO: 1 row

-- 3. Verificar foreign key
SELECT conname, confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE conrelid = 'public.alunos'::regclass
  AND conname = 'alunos_linked_user_id_fkey';
-- RESULTADO ESPERADO: 1 row com foreign_table = app_auth.users

-- 4. Verificar índice
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'alunos'
  AND indexname = 'idx_alunos_linked_user_id';
-- RESULTADO ESPERADO: 1 row
```

## Validação de Schema (Backend)

### Boot-Time Validation

O backend valida a existência de `linked_user_id` **no boot** (fail-fast):

- **Código**: `/root/server/utils/schema-validator.js`
- **Função**: `assertDatabaseSchema(pool, dbConfig)`
- **Comportamento**: Se coluna não existir, servidor inicia em modo DEGRADED (rotas críticas bloqueadas)

### Identidade do Banco

O backend loga a identidade do banco conectado (database, schema, host, port, user) no boot:

- **Código**: `/root/server/utils/db-identity.js`
- **Objetivo**: Garantir que migração foi aplicada no banco correto
- **Log**: `db.identity.validated` (inclui database, schema, timestamp)

### Modo DEGRADED

Quando `linked_user_id` não existe:

- Servidor sobe normalmente (não crasha)
- Rotas críticas (`/auth/*`, `/rest/v1/*`) retornam 503 Service Unavailable
- Health check (`/health`) retorna status `degraded` com detalhes
- Mensagem de erro inclui instruções de verificação manual

## Frontend

### Componente: UserLinkingManager

**Arquivo**: `/root/src/components/UserLinkingManager.tsx`

- **Fonte de verdade**: `aluno.linked_user_id`
- **Determinação de vínculo**: `linked_user_id IS NOT NULL` → vinculado
- **UI**: Select auto-search (Combobox) para credenciais disponíveis quando `linked_user_id IS NULL`

### API Contract

- **Endpoint**: `PATCH /rest/v1/alunos`
- **Campo permitido**: `linked_user_id` (whitelist)
- **Validação**: Backend valida existência de `app_auth.users.id` antes de atualizar

## Histórico (Recomendado, mas Não Obrigatório)

Para auditoria futura, considere criar tabela `alunos_user_link_history`:

```sql
CREATE TABLE IF NOT EXISTS public.alunos_user_link_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID NOT NULL REFERENCES public.alunos(id),
    user_id UUID REFERENCES app_auth.users(id),
    action TEXT NOT NULL CHECK (action IN ('LINK', 'UNLINK')),
    performed_by UUID REFERENCES app_auth.users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Nota**: Histórico não é obrigatório para o vínculo inicial, mas recomendado para rastreabilidade.

## Anti-Patterns a Evitar

1. ❌ **Não usar email como fonte de verdade para vínculo**
   - Email pode mudar
   - Email pode não existir inicialmente

2. ❌ **Não criar UNIQUE constraint em `linked_user_id`**
   - Limita flexibilidade futura
   - Não há requisito de negócio para 1:1 estrito

3. ❌ **Não mover vínculo para tabela paralela**
   - Adiciona complexidade desnecessária
   - `linked_user_id` direto é mais simples e performático

4. ❌ **Não permitir múltiplos usuários por aluno**
   - Design atual suporta apenas 1:1 (um aluno, um usuário)
   - Se necessário no futuro, pode ser evoluído

5. ❌ **Não permitir update silencioso via payload livre**
   - Backend usa whitelist para `alunos` updates
   - Apenas campos permitidos são atualizados

## Aceitação

### Critérios de Aceitação

- ✅ Backend loga banco e schema no boot
- ✅ Servidor não inicia (modo DEGRADED) se coluna não existir
- ✅ Migração aplicada no banco correto elimina o erro
- ✅ `PATCH /alunos` aceita `linked_user_id`
- ✅ Vínculo aluno ↔ usuário funciona sem exceções
- ✅ Erro nunca reaparece em produção (validação no boot)

### Verificação Manual

1. Verificar log de boot do backend:
   ```
   db.identity.validated: { database: "blackhouse_db", schema: "public", ... }
   ```

2. Verificar health check:
   ```bash
   curl https://api.blackhouse.app.br/health
   # Deve retornar: { "status": "ok", "schema": { "valid": true } }
   ```

3. Verificar que migração foi aplicada:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'alunos' AND column_name = 'linked_user_id';
   -- Deve retornar 1 row
   ```

## Referências

- **Migração SQL**: `/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql`
- **Schema Validator**: `/root/server/utils/schema-validator.js`
- **DB Identity Validator**: `/root/server/utils/db-identity.js`
- **Frontend Component**: `/root/src/components/UserLinkingManager.tsx`
- **Documentação Urgente**: `/root/SCHEMA-LINKED-USER-ID-URGENT.md`
