# 📋 Como Exportar Apenas o Schema PUBLIC

## ⚠️ Problema Identificado

O schema que você exportou inclui tabelas do `storage`, que **NÃO devem ser importadas** no PostgreSQL local. Precisamos exportar **apenas o schema `public`**.

## ✅ Solução: Queries Corretas

### Passo 1: Listar Apenas Tabelas do Schema PUBLIC

Execute esta query no SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;
```

**Anote os nomes das tabelas** que aparecerem. Essas são as únicas que você precisa exportar.

### Passo 2: Exportar Estrutura (CREATE TABLE)

Execute esta query para gerar CREATE TABLE apenas do schema public:

```sql
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' || E'\n' ||
    string_agg(
        '    ' || column_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            WHEN data_type = 'ARRAY' THEN 
                (SELECT udt_name FROM information_schema.element_types 
                 WHERE object_schema = 'public' 
                   AND object_name = table_name 
                   AND object_type = 'TABLE'
                   LIMIT 1) || '[]'
            ELSE data_type
        END ||
        CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE 
            WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ',' || E'\n'
        ORDER BY ordinal_position
    ) ||
    E'\n);'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
GROUP BY table_name
ORDER BY table_name;
```

**Copie todos os resultados** e salve em `schema_public.sql`

### Passo 3: Exportar Dados de Cada Tabela

Para **cada tabela** listada no Passo 1, execute:

```sql
-- Substitua 'nome_tabela' pelo nome real
COPY (
    SELECT * FROM nome_tabela
    ORDER BY id  -- ou created_at, ou outra coluna
) TO STDOUT WITH CSV HEADER;
```

**Copie o resultado** e salve como `nome_tabela.csv` ou adicione ao arquivo `data.sql`

### Passo 4: Exportar Constraints

**Primary Keys:**
```sql
SELECT 
    'ALTER TABLE ' || table_name || 
    ' ADD CONSTRAINT ' || constraint_name || 
    ' PRIMARY KEY (' || 
    string_agg(column_name, ', ' ORDER BY ordinal_position) || 
    ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name NOT LIKE 'pg_%'
GROUP BY table_name, constraint_name
ORDER BY table_name;
```

**Foreign Keys:**
```sql
SELECT 
    'ALTER TABLE ' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || 
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || 
    ') REFERENCES ' || 
    ccu.table_name || 
    ' (' || 
    string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) || 
    ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name NOT LIKE 'pg_%'
GROUP BY tc.table_name, tc.constraint_name, ccu.table_name
ORDER BY tc.table_name;
```

## 🚫 O que NÃO Exportar

**NÃO exporte:**
- ❌ `storage.*` - Tabelas de storage do Supabase
- ❌ `auth.*` - Tabelas de autenticação do Supabase
- ❌ `supabase_functions.*` - Funções do Supabase
- ❌ `realtime.*` - Realtime do Supabase
- ❌ `vault.*` - Vault do Supabase
- ❌ `pg_*` - Tabelas do sistema PostgreSQL

**Exporte APENAS:**
- ✅ `public.*` - Suas tabelas de aplicação

## 📝 Exemplo Prático

Suponha que você tenha estas tabelas no schema public:
- `exercises`
- `workouts`
- `users`
- `progress_photos`

### 1. Exportar estrutura:
```sql
-- Execute a query do Passo 2
-- Copie os CREATE TABLE statements
```

### 2. Exportar dados:
```sql
-- Para cada tabela:
COPY (SELECT * FROM exercises ORDER BY id) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM workouts ORDER BY id) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM users ORDER BY id) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM progress_photos ORDER BY id) TO STDOUT WITH CSV HEADER;
```

### 3. Organizar arquivos:
- `schema_public.sql` - Todos os CREATE TABLE
- `data.sql` - Todos os dados (ou arquivos CSV separados)

## ✅ Checklist

- [ ] Liste apenas tabelas do schema `public`
- [ ] Exporte CREATE TABLE apenas do `public`
- [ ] Exporte dados apenas do `public`
- [ ] Exporte constraints apenas do `public`
- [ ] **NÃO** inclua `storage`, `auth`, etc.
- [ ] Verifique que não há referências a schemas do Supabase

## 🔍 Verificar Antes de Importar

Antes de importar, verifique se o arquivo não contém:

```bash
# Verificar se há referências a storage
grep -i "storage\." schema_public.sql

# Verificar se há referências a auth
grep -i "auth\." schema_public.sql

# Deve retornar vazio ou apenas comentários
```

---

**Use o arquivo `QUERIES_EXPORTAR_APENAS_PUBLIC.sql` que tem todas as queries prontas!**
