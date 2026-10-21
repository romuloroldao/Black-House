# ⚠️ URGENTE: Coluna linked_user_id não existe - Aplicar Migração

## Status Atual
❌ **BLOQUEADOR**: A coluna `linked_user_id` **NÃO existe** na tabela `alunos`, causando erro 400 em todos os PATCH requests que tentam atualizar este campo.

## Verificação
```sql
-- Executar para verificar:
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'alunos' AND column_name = 'linked_user_id';

-- Resultado esperado: 0 linhas (coluna não existe)
```

## Impacto
- ❌ PATCH `/rest/v1/alunos` falha com erro 400 quando `linked_user_id` é enviado
- ❌ Frontend não consegue vincular usuários importados
- ❌ Funcionalidade de vinculação está quebrada

## Backend está correto
✅ O backend Node.js está funcionando corretamente:
- Detecta erro de coluna inexistente (PostgreSQL código 42703)
- Retorna erro 400 com mensagem clara: "Coluna não encontrada no schema"
- Aceitará `linked_user_id` automaticamente após a coluna existir
- **NÃO usa PostgREST** - usa backend Node.js/Express customizado

## Solução: Aplicar Migração SQL

### Opção 1: Via Supabase Dashboard (Recomendado - Mais Seguro)
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **"SQL Editor"**
4. Cole e execute o SQL abaixo:

```sql
-- SCHEMA-02: Adicionar campo linked_user_id à tabela alunos
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS linked_user_id UUID NULL;

ALTER TABLE public.alunos
DROP CONSTRAINT IF EXISTS alunos_linked_user_id_fkey;

ALTER TABLE public.alunos
ADD CONSTRAINT alunos_linked_user_id_fkey
FOREIGN KEY (linked_user_id)
REFERENCES app_auth.users(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_alunos_linked_user_id ON public.alunos(linked_user_id);

COMMENT ON COLUMN public.alunos.linked_user_id IS 'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.';

-- Atualizar registros existentes: inferir linked_user_id de alunos que têm email correspondente
UPDATE public.alunos a
SET linked_user_id = u.id
FROM app_auth.users u
WHERE a.email IS NOT NULL 
  AND a.email != ''
  AND a.email = u.email
  AND a.linked_user_id IS NULL;
```

### Opção 2: Via psql (Direto no Servidor)
```bash
# Conectar como superuser
psql -U postgres -d seu_banco

# Executar SQL acima ou:
\i /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

## Verificação Após Aplicar

```sql
-- 1. Verificar coluna criada:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'alunos' 
  AND column_name = 'linked_user_id';
-- Resultado esperado: 1 linha com linked_user_id

-- 2. Verificar foreign key:
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
  AND table_name = 'alunos' 
  AND constraint_type = 'FOREIGN KEY' 
  AND constraint_name LIKE '%linked_user%';
-- Resultado esperado: 1 linha com alunos_linked_user_id_fkey

-- 3. Verificar índice:
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'alunos' 
  AND indexname = 'idx_alunos_linked_user_id';
-- Resultado esperado: 1 linha
```

## Teste Após Aplicar

```bash
# Testar PATCH com linked_user_id
curl -X PATCH https://api.blackhouse.app.br/rest/v1/alunos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "aluno-uuid",
    "linked_user_id": "user-uuid"
  }'

# Deve retornar 200 (ou 401 se token inválido, mas NÃO 400 por coluna inexistente)
```

## Arquivo da Migração
`/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql`

## Observações Importantes
- ⚠️ A migração **DEVE** ser aplicada com privilégios de **owner/superuser**
- ⚠️ O usuário `app_user` usado pelo backend **NÃO tem** privilégios para `ALTER TABLE`
- ✅ Após aplicar, o backend aceitará `linked_user_id` automaticamente (sem mudanças de código)
- ✅ Não é necessário reiniciar o backend após aplicar a migração

## Próximos Passos
1. **URGENTE**: Aplicar migração SQL usando uma das opções acima
2. Verificar se coluna foi criada (SQL de verificação)
3. Testar PATCH `/rest/v1/alunos` com `linked_user_id`
4. Validar funcionamento da vinculação no frontend
