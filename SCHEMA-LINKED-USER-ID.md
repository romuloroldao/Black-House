# SCHEMA-02: Migração linked_user_id para tabela alunos

## Status
❌ **PENDENTE**: A migração precisa ser aplicada manualmente com privilégios de owner/superuser.

## Problema Atual
A coluna `linked_user_id` não existe na tabela `alunos`, causando erro 500 ao tentar vincular usuários importados às credenciais.

## Solução

### SQL da Migração
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

### Como Aplicar

**Opção 1: Via Supabase Dashboard (Recomendado)**
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em "SQL Editor"
4. Cole o SQL acima e execute

**Opção 2: Via psql**
```bash
psql -U postgres -d seu_banco < /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

### Verificação Após Aplicação
```sql
-- Verificar coluna
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'alunos' 
  AND column_name = 'linked_user_id';

-- Verificar foreign key
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
  AND table_name = 'alunos' 
  AND constraint_type = 'FOREIGN KEY' 
  AND constraint_name LIKE '%linked_user%';
```

## Arquivo da Migração
`/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql`

## Impacto
- ✅ Frontend: `UserLinkingManager.tsx` já está preparado para usar `linked_user_id`
- ✅ Backend: `app.patch('/rest/v1/:table')` agora retorna erro 400 (em vez de 500) quando coluna não existe
- ⚠️  Database: Migração precisa ser aplicada manualmente
