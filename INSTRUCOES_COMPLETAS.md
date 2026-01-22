# 📋 Instruções Completas para Importação

## ✅ Todos os Scripts SQL Foram Criados!

Agora você tem todos os 4 scripts SQL prontos para importar os dados:

### 📁 Arquivos Criados:

1. ✅ **buckets_inserts.sql** - 2 buckets (avatars e progress-photos)
2. ✅ **migrations_inserts.sql** - 50 migrations
3. ✅ **objects_inserts.sql** - 4 objetos de storage
4. ✅ **prefixes_inserts.sql** - 3 prefixes

---

## 🚀 Como Executar no Supabase

### Passo 1: Acessar o Supabase

1. Acesse: https://app.supabase.com
2. Faça login na sua conta
3. Selecione seu projeto

### Passo 2: Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **"SQL Editor"**
2. Clique em **"New query"** (ou use o botão "+")

### Passo 3: Executar os Scripts (NESTA ORDEM!)

⚠️ **IMPORTANTE:** Execute nesta ordem exata:

#### 1️⃣ Primeiro: Buckets
- Abra o arquivo: `/root/buckets_inserts.sql`
- Copie TODO o conteúdo (Ctrl+A, Ctrl+C)
- Cole no SQL Editor
- Clique em **"Run"** ou pressione **Ctrl+Enter**
- ✅ Deve inserir 2 buckets

#### 2️⃣ Segundo: Migrations
- Abra o arquivo: `/root/migrations_inserts.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor
- Execute
- ✅ Deve inserir 50 migrations

**Nota:** Se der erro sobre estrutura da tabela, use `migrations_inserts_alternativo.sql` em vez deste.

#### 3️⃣ Terceiro: Objects
- Abra o arquivo: `/root/objects_inserts.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor
- Execute
- ✅ Deve inserir 4 objetos

#### 4️⃣ Quarto: Prefixes
- Abra o arquivo: `/root/prefixes_inserts.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor
- Execute
- ✅ Deve inserir 3 prefixes

**Nota:** Se der erro sobre o campo `level`, use a versão alternativa comentada no próprio arquivo.

---

## ✅ Verificação Final

Após executar todos os scripts, execute esta query para verificar:

```sql
-- Verificar totais
SELECT 
    'buckets' as tabela,
    COUNT(*) as total
FROM storage.buckets
UNION ALL
SELECT 
    'migrations' as tabela,
    COUNT(*) as total
FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 
    'objects' as tabela,
    COUNT(*) as total
FROM storage.objects
UNION ALL
SELECT 
    'prefixes' as tabela,
    COUNT(*) as total
FROM storage.prefixes;
```

**Resultado esperado:**
- buckets: 2
- migrations: 50
- objects: 4
- prefixes: 3

---

## 🐛 Solução de Problemas

### Erro: "Tabela não existe"
- Certifique-se de que está no projeto correto do Supabase
- As tabelas são criadas automaticamente pelo Supabase

### Erro: "Coluna não existe"
- Verifique se a estrutura da tabela corresponde ao script
- Use as versões alternativas se disponíveis

### Erro: "Violação de constraint"
- Os scripts usam `ON CONFLICT DO NOTHING`, então dados duplicados são ignorados
- Se já existirem dados, não haverá erro

### Erro: "Formato de data inválido"
- Os timestamps estão no formato correto
- Se houver erro, verifique o timezone do banco

---

## 📊 Resumo dos Dados

| Tabela | Registros | Descrição |
|--------|-----------|-----------|
| `storage.buckets` | 2 | Buckets: avatars e progress-photos |
| `supabase_migrations.schema_migrations` | 50 | Histórico de migrations executadas |
| `storage.objects` | 4 | Arquivos de storage (2 avatares + 2 fotos de progresso) |
| `storage.prefixes` | 3 | Prefixos organizacionais |

---

## 🎉 Pronto!

Após executar todos os scripts, seus dados estarão importados no Supabase!

Se tiver qualquer problema, me avise e eu ajudo! 🚀
