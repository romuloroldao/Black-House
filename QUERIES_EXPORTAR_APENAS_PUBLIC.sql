-- ==========================================
-- QUERIES PARA EXPORTAR APENAS SCHEMA PUBLIC
-- Execute no SQL Editor do Supabase
-- ==========================================

-- ==========================================
-- 1. LISTAR APENAS TABELAS DO SCHEMA PUBLIC
-- ==========================================
SELECT 
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
       AND table_name = t.table_name) as num_colunas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'  -- Excluir tabelas do sistema
ORDER BY table_name;

-- ==========================================
-- 2. GERAR CREATE TABLE PARA SCHEMA PUBLIC
-- ==========================================
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
    as create_table_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
GROUP BY table_name
ORDER BY table_name;

-- ==========================================
-- 3. EXPORTAR DADOS DE CADA TABELA (CSV)
-- ==========================================
-- Execute esta query para cada tabela listada na query 1
-- Substitua 'nome_tabela' pelo nome real

COPY (
    SELECT * FROM nome_tabela
    ORDER BY id  -- ou outra coluna de ordenação
) TO STDOUT WITH CSV HEADER;

-- ==========================================
-- 4. GERAR COPY STATEMENTS PARA TODAS AS TABELAS PUBLIC
-- ==========================================
SELECT 
    '-- ==========================================' || E'\n' ||
    '-- Exportar: ' || table_name || E'\n' ||
    '-- ==========================================' || E'\n' ||
    'COPY (' || E'\n' ||
    '    SELECT * FROM ' || table_name || E'\n' ||
    '    ORDER BY ' || 
    COALESCE(
        (SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
           AND table_name = t.table_name 
           AND column_name IN ('id', 'created_at', 'updated_at')
         ORDER BY 
           CASE column_name 
             WHEN 'id' THEN 1 
             WHEN 'created_at' THEN 2 
             WHEN 'updated_at' THEN 3 
           END
         LIMIT 1),
        (SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
           AND table_name = t.table_name
         ORDER BY ordinal_position
         LIMIT 1)
    ) || E'\n' ||
    ') TO STDOUT WITH CSV HEADER;' || E'\n' || E'\n'
    as copy_statement
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- ==========================================
-- 5. EXPORTAR PRIMARY KEYS DO SCHEMA PUBLIC
-- ==========================================
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
  AND tc.table_name NOT LIKE 'pg_%'
GROUP BY table_name, constraint_name
ORDER BY table_name;

-- ==========================================
-- 6. EXPORTAR FOREIGN KEYS DO SCHEMA PUBLIC
-- ==========================================
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
  AND tc.table_name NOT LIKE 'pg_%'
GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.delete_rule
ORDER BY tc.table_name;

-- ==========================================
-- 7. EXPORTAR INDEXES DO SCHEMA PUBLIC
-- ==========================================
SELECT 
    'CREATE INDEX IF NOT EXISTS ' || indexname || 
    ' ON ' || tablename || 
    ' USING ' || 
    CASE 
        WHEN indexdef LIKE '%USING%' THEN 
            substring(indexdef from 'USING ([a-z]+)')
        ELSE 'btree'
    END ||
    ' (' || 
    substring(indexdef from '\((.+)\)') ||
    ');' as index_statement
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename, indexname;

-- ==========================================
-- 8. VERIFICAR SE HÁ DADOS NAS TABELAS
-- ==========================================
SELECT 
    'SELECT COUNT(*) as ' || table_name || '_count FROM ' || table_name || ';' as count_query
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- Execute cada query gerada para ver quantos registros há em cada tabela
