-- ==========================================
-- QUERIES SIMPLIFICADAS PARA EXPORTAÇÃO
-- Execute no SQL Editor do Supabase
-- ==========================================

-- ==========================================
-- 1. LISTAR TODAS AS TABELAS
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
ORDER BY table_name;

-- ==========================================
-- 2. EXPORTAR DADOS DE UMA TABELA (CSV)
-- ==========================================
-- Substitua 'nome_tabela' pelo nome real
-- Exemplo: COPY (SELECT * FROM exercises) TO STDOUT WITH CSV HEADER;

COPY (
    SELECT * FROM nome_tabela
    ORDER BY id  -- ou a coluna de ordenação apropriada
) TO STDOUT WITH CSV HEADER;

-- ==========================================
-- 3. EXPORTAR DADOS COMO INSERT STATEMENTS
-- ==========================================
-- Substitua 'nome_tabela' e ajuste as colunas

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

-- ==========================================
-- 4. VER ESTRUTURA DE UMA TABELA
-- ==========================================
-- Use o comando \d no psql ou:
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nome_tabela'
ORDER BY ordinal_position;

-- ==========================================
-- 5. CONTAR REGISTROS DE TODAS AS TABELAS
-- ==========================================
SELECT 
    'SELECT COUNT(*) as ' || table_name || '_count FROM ' || table_name || ';' as count_query
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ==========================================
-- 6. GERAR COPY STATEMENTS PARA TODAS AS TABELAS
-- ==========================================
SELECT 
    '-- Exportar ' || table_name || E'\n' ||
    'COPY (SELECT * FROM ' || table_name || ') TO STDOUT WITH CSV HEADER;' || E'\n'
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ==========================================
-- 7. EXPORTAR PRIMARY KEYS
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
GROUP BY table_name, constraint_name
ORDER BY table_name;

-- ==========================================
-- 8. EXPORTAR FOREIGN KEYS
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

-- ==========================================
-- 9. EXPORTAR INDEXES
-- ==========================================
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ==========================================
-- 10. EXPORTAR SEQUENCES
-- ==========================================
SELECT 
    sequence_name,
    last_value,
    increment_by
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;
