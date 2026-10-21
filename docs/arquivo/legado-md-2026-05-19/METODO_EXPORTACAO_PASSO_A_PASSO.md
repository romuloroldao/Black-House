# 📋 Método Passo a Passo - Exportação Manual no Supabase

## 🎯 Método Mais Simples e Eficiente

### Passo 1: Acessar SQL Editor

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `cghzttbggklhuyqxzabq`
3. Clique em **"SQL Editor"** no menu lateral

### Passo 2: Listar Todas as Tabelas

Execute esta query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Anote os nomes das tabelas** que aparecerem (ex: `exercises`, `workouts`, `users`, etc.)

### Passo 3: Para Cada Tabela - Exportar Dados

Para cada tabela listada, execute:

#### 3.1. Ver Estrutura (Opcional mas Recomendado)

```sql
-- Substitua 'nome_tabela' pelo nome real
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nome_tabela'
ORDER BY ordinal_position;
```

#### 3.2. Contar Registros

```sql
SELECT COUNT(*) as total FROM nome_tabela;
```

#### 3.3. Exportar Dados (Método CSV - Recomendado)

```sql
COPY (
    SELECT * FROM nome_tabela
    ORDER BY id  -- ou outra coluna de ordenação
) TO STDOUT WITH CSV HEADER;
```

**Copie todo o resultado** e salve em um arquivo chamado `nome_tabela.csv`

#### 3.4. Exportar Dados (Método INSERT - Alternativo)

Se preferir INSERT statements:

```sql
-- Primeiro, veja as colunas da tabela
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nome_tabela'
ORDER BY ordinal_position;

-- Depois, ajuste esta query com as colunas reais
SELECT 
    'INSERT INTO nome_tabela (col1, col2, col3) VALUES ' ||
    string_agg(
        '(' ||
        COALESCE(quote_literal(col1::text), 'NULL') || ', ' ||
        COALESCE(quote_literal(col2::text), 'NULL') || ', ' ||
        COALESCE(quote_literal(col3::text), 'NULL') ||
        ')',
        ',' || E'\n    '
    ) || ';'
FROM nome_tabela;
```

**Copie o resultado** e salve em `nome_tabela_inserts.sql`

### Passo 4: Exportar Estrutura (Schema)

#### 4.1. Exportar CREATE TABLE Statements

Execute esta query para gerar CREATE TABLE para todas as tabelas:

```sql
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

**Copie cada CREATE TABLE** e salve em `schema_public.sql`

#### 4.2. Exportar Constraints

**Primary Keys:**
```sql
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
    ');' as fk_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
GROUP BY tc.table_name, tc.constraint_name, ccu.table_name
ORDER BY tc.table_name;
```

**Indexes:**
```sql
SELECT 
    'CREATE INDEX IF NOT EXISTS ' || indexname || 
    ' ON ' || tablename || 
    ' (' || indexdef || ');' as index_statement
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Passo 5: Organizar Arquivos

Crie os seguintes arquivos:

1. **`schema_public.sql`** - Todos os CREATE TABLE, constraints e indexes
2. **`data.sql`** - Todos os INSERT statements (se usar método INSERT)
   - OU arquivos CSV separados: `tabela1.csv`, `tabela2.csv`, etc.

### Passo 6: Transferir para VPS

```bash
# Do seu computador
scp schema_public.sql root@177.153.64.95:/root/backup/
scp data.sql root@177.153.64.95:/root/backup/
# Ou se usar CSV:
scp *.csv root@177.153.64.95:/root/backup/
```

### Passo 7: Na VPS - Importar

```bash
ssh root@177.153.64.95
cd /root
./scripts/preparar-importacao.sh
./scripts/importar-dados.sh
```

---

## 🎯 Exemplo Prático Completo

Vamos supor que você tenha uma tabela chamada `exercises`:

### 1. Ver estrutura:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'exercises';
```

Resultado exemplo:
- id (uuid)
- name (text)
- description (text)
- created_at (timestamp)

### 2. Exportar dados:
```sql
COPY (
    SELECT * FROM exercises
    ORDER BY created_at
) TO STDOUT WITH CSV HEADER;
```

### 3. Copiar resultado e salvar como `exercises.csv`

### 4. Repetir para todas as outras tabelas

---

## ✅ Checklist de Exportação

- [ ] Listei todas as tabelas
- [ ] Exportei estrutura (CREATE TABLE) de cada tabela
- [ ] Exportei dados (COPY ou INSERT) de cada tabela
- [ ] Exportei constraints (PK, FK)
- [ ] Exportei indexes
- [ ] Salvei tudo em arquivos organizados
- [ ] Transfiri arquivos para a VPS
- [ ] Executei scripts de importação na VPS

---

## 📚 Arquivos de Referência

- `QUERIES_EXPORTACAO_MANUAL.md` - Guia completo com todas as queries
- `QUERIES_EXPORTACAO_SIMPLIFICADA.sql` - Arquivo SQL com queries prontas

---

**Dica**: Use o método COPY com CSV - é o mais simples e eficiente!
