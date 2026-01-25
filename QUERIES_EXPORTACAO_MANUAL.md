# 📝 Queries SQL para Exportação Manual no Supabase

## 🎯 Como Usar

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `cghzttbggklhuyqxzabq`
3. Vá em: **SQL Editor**
4. Execute as queries abaixo
5. Copie os resultados e salve em arquivos SQL

---

## 📋 Parte 1: Listar Todas as Tabelas Públicas

Execute esta query primeiro para ver todas as tabelas:

```sql
-- Listar todas as tabelas do schema public
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = t.table_name) as colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 📋 Parte 2: Exportar Estrutura (Schema) de Cada Tabela

### 2.1. Obter CREATE TABLE de todas as tabelas

```sql
-- Gerar CREATE TABLE para todas as tabelas
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' || E'\n' ||
    string_agg(
        '    ' || column_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            WHEN data_type = 'ARRAY' THEN 
                (SELECT data_type FROM information_schema.element_types 
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
    as create_table_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
```

### 2.2. Obter Constraints (Primary Keys, Foreign Keys, etc.)

```sql
-- Exportar Primary Keys
SELECT 
    'ALTER TABLE ' || table_name || 
    ' ADD CONSTRAINT ' || constraint_name || 
    ' PRIMARY KEY (' || 
    string_agg(column_name, ', ' ORDER BY ordinal_position) || 
    ');' as pk_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY table_name, constraint_name
ORDER BY table_name;
```

```sql
-- Exportar Foreign Keys
SELECT 
    'ALTER TABLE ' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || 
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || 
    ') REFERENCES ' || 
    ccu.table_name || 
    ' (' || 
    string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) || 
    ')' ||
    CASE 
        WHEN rc.delete_rule != 'NO ACTION' 
        THEN ' ON DELETE ' || rc.delete_rule 
        ELSE '' 
    END ||
    ';' as fk_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.delete_rule
ORDER BY tc.table_name;
```

```sql
-- Exportar Indexes
SELECT 
    'CREATE INDEX IF NOT EXISTS ' || indexname || 
    ' ON ' || tablename || 
    ' (' || indexdef || ');' as index_statement
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 2.3. Obter Sequences (Auto-increment)

```sql
-- Exportar Sequences
SELECT 
    'CREATE SEQUENCE IF NOT EXISTS ' || sequence_name ||
    ' START WITH ' || last_value ||
    ' INCREMENT BY ' || increment_by ||
    ';' as sequence_statement
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
```

---

## 📋 Parte 3: Exportar Dados (INSERT Statements)

### 3.1. Gerar INSERT para uma tabela específica

Substitua `nome_da_tabela` pelo nome real:

```sql
-- Template para gerar INSERT de uma tabela
-- Substitua 'nome_da_tabela' pelo nome real da tabela

SELECT 
    'INSERT INTO nome_da_tabela (' || 
    string_agg(column_name, ', ' ORDER BY ordinal_position) || 
    ') VALUES ' || E'\n' ||
    string_agg(
        '(' || 
        string_agg(
            CASE 
                WHEN value IS NULL THEN 'NULL'
                WHEN data_type IN ('text', 'varchar', 'char', 'date', 'timestamp', 'timestamptz') 
                THEN quote_literal(value::text)
                WHEN data_type = 'boolean' 
                THEN value::text
                WHEN data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision')
                THEN value::text
                WHEN data_type = 'uuid' 
                THEN quote_literal(value::text)
                WHEN data_type = 'jsonb' OR data_type = 'json'
                THEN quote_literal(value::text)
                ELSE quote_literal(value::text)
            END,
            ', ' ORDER BY ordinal_position
        ) ||
        ')',
        ',' || E'\n' 
    ) || ';'
FROM (
    SELECT * FROM nome_da_tabela
) t
CROSS JOIN information_schema.columns c
WHERE c.table_schema = 'public' 
  AND c.table_name = 'nome_da_tabela'
GROUP BY ...;
```

### 3.2. Query Simplificada para Exportar Dados (CSV-like)

Para cada tabela, execute:

```sql
-- Exemplo: Exportar dados da tabela 'exercises'
-- Substitua 'exercises' pelo nome da sua tabela

SELECT 
    'INSERT INTO exercises VALUES ' ||
    string_agg(
        '(' ||
        COALESCE(quote_literal(id::text), 'NULL') || ', ' ||
        COALESCE(quote_literal(name), 'NULL') || ', ' ||
        -- Adicione todas as colunas aqui
        COALESCE(created_at::text, 'NULL') ||
        ')',
        ',' || E'\n    '
    ) || ';'
FROM exercises;
```

### 3.3. Script Dinâmico para Todas as Tabelas

```sql
-- Gerar queries de INSERT para todas as tabelas
-- Execute o resultado desta query para cada tabela

SELECT 
    '-- Exportar dados de ' || table_name || E'\n' ||
    'COPY ' || table_name || ' TO STDOUT WITH CSV HEADER;' || E'\n' ||
    '-- Ou use: SELECT * FROM ' || table_name || ';' || E'\n'
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 📋 Parte 4: Exportar Dados via COPY (Mais Eficiente)

### 4.1. Exportar cada tabela como CSV

Para cada tabela, execute:

```sql
-- Exemplo para tabela 'exercises'
COPY (
    SELECT * FROM exercises
) TO STDOUT WITH CSV HEADER;
```

### 4.2. Gerar COPY statements para todas as tabelas

```sql
-- Gerar comandos COPY para todas as tabelas
SELECT 
    'COPY (SELECT * FROM ' || table_name || ') TO STDOUT WITH CSV HEADER;' as copy_statement
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 📋 Parte 5: Exportar Funções, Triggers e Views

### 5.1. Exportar Funções

```sql
-- Listar todas as funções
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

### 5.2. Exportar Triggers

```sql
-- Listar todos os triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### 5.3. Exportar Views

```sql
-- Listar todas as views
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 📋 Parte 6: Exportação Completa Simplificada

### 6.1. Query para Gerar Script Completo

Execute esta query para gerar um script SQL completo:

```sql
-- Gerar script completo de exportação
WITH tables AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
)
SELECT 
    '-- ==========================================' || E'\n' ||
    '-- EXPORTAÇÃO DE DADOS - ' || table_name || E'\n' ||
    '-- ==========================================' || E'\n' ||
    E'\n' ||
    '-- Estrutura da tabela' || E'\n' ||
    '\d ' || table_name || E'\n' ||
    E'\n' ||
    '-- Dados da tabela' || E'\n' ||
    'SELECT * FROM ' || table_name || ';' || E'\n' ||
    E'\n'
FROM tables;
```

---

## 🎯 Método Prático Recomendado

### Passo 1: Listar Tabelas

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Passo 2: Para Cada Tabela, Execute

```sql
-- Substitua 'nome_tabela' pelo nome real
-- Exemplo: 'exercises', 'users', 'workouts', etc.

-- 1. Ver estrutura
\d nome_tabela

-- 2. Exportar dados como INSERT
SELECT 
    'INSERT INTO nome_tabela VALUES ' ||
    string_agg(
        '(' ||
        -- Ajuste conforme as colunas da sua tabela
        COALESCE(quote_literal(id::text), 'NULL') || ', ' ||
        COALESCE(quote_literal(name), 'NULL') ||
        ')',
        ',' || E'\n    '
    ) || ';'
FROM nome_tabela;
```

### Passo 3: Exportar como CSV (Mais Fácil)

```sql
-- Para cada tabela
COPY (SELECT * FROM nome_tabela) TO STDOUT WITH CSV HEADER;
```

Copie o resultado e salve como `nome_tabela.csv`

---

## 📝 Exemplo Completo para Tabela 'exercises'

```sql
-- 1. Ver estrutura
\d exercises

-- 2. Contar registros
SELECT COUNT(*) FROM exercises;

-- 3. Exportar dados
COPY (
    SELECT * FROM exercises
    ORDER BY id
) TO STDOUT WITH CSV HEADER;

-- 4. Ou como INSERT statements
SELECT 
    'INSERT INTO exercises (id, name, description, created_at) VALUES ' ||
    string_agg(
        '(' ||
        quote_literal(id::text) || ', ' ||
        quote_literal(name) || ', ' ||
        COALESCE(quote_literal(description), 'NULL') || ', ' ||
        quote_literal(created_at::text) ||
        ')',
        ',' || E'\n    '
    ) || ';'
FROM exercises;
```

---

## ✅ Checklist de Exportação

Para cada tabela:

- [ ] Ver estrutura: `\d nome_tabela`
- [ ] Contar registros: `SELECT COUNT(*) FROM nome_tabela;`
- [ ] Exportar dados: `COPY (SELECT * FROM nome_tabela) TO STDOUT WITH CSV HEADER;`
- [ ] Salvar resultado em arquivo
- [ ] Verificar se todos os dados foram exportados

---

## 🔧 Dica: Usar pg_dump via SQL (se disponível)

Se o Supabase permitir executar comandos do sistema:

```sql
-- Isso geralmente não funciona no SQL Editor, mas tente:
\! pg_dump -h localhost -U postgres -d postgres --schema-only --schema=public > schema.sql
```

---

## 📚 Próximos Passos

Após exportar:

1. Salve os resultados em arquivos `.sql` ou `.csv`
2. Transfira para a VPS: `scp arquivo.sql root@177.153.64.95:/root/backup/`
3. Execute: `./scripts/preparar-importacao.sh`
4. Execute: `./scripts/importar-dados.sh`

---

**Nota**: O método COPY com CSV é o mais fácil e eficiente. Use-o quando possível!
