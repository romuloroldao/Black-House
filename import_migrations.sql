-- ============================================================================
-- IMPORTAR DADOS DE MIGRATIONS
-- ============================================================================
-- Este script importa dados do arquivo migrations_rows.csv
-- para a tabela supabase_migrations.schema_migrations
-- ============================================================================

-- Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_migrations' 
        AND table_name = 'schema_migrations'
    ) THEN
        RAISE EXCEPTION 'Tabela supabase_migrations.schema_migrations não existe';
    END IF;
END $$;

-- Método 1: Usando COPY (mais rápido, requer acesso ao servidor)
-- Descomente e ajuste o caminho do arquivo:
/*
COPY supabase_migrations.schema_migrations (
    version,
    name,
    statements,
    inserted_at
)
FROM '/caminho/para/migrations_rows.csv'
WITH (
    FORMAT csv,
    HEADER true,
    DELIMITER ',',
    QUOTE '"',
    ESCAPE '"'
);
*/

-- Método 2: Usando INSERT (funciona via SQL Editor do Supabase)
-- Primeiro, leia o arquivo CSV e ajuste os valores abaixo conforme necessário

-- Exemplo de estrutura esperada (ajuste conforme seu CSV):
-- version | name | statements | inserted_at
-- --------|------|------------|-------------

-- IMPORTANTE: Substitua os valores abaixo pelos dados reais do seu CSV
-- Você pode gerar os INSERTs usando um script Python ou Node.js

-- Exemplo de INSERT (ajuste conforme necessário):
/*
INSERT INTO supabase_migrations.schema_migrations (
    version,
    name,
    statements,
    inserted_at
) VALUES
-- Adicione seus dados aqui
-- Exemplo:
('20240101000000', 'initial_schema', ARRAY['CREATE TABLE...'], NOW()),
('20240102000000', 'add_users_table', ARRAY['CREATE TABLE...'], NOW())
ON CONFLICT (version) DO NOTHING;
*/

-- ============================================================================
-- SCRIPT PYTHON PARA GERAR INSERTS AUTOMATICAMENTE
-- ============================================================================
-- Execute este script Python para gerar os INSERTs automaticamente:
/*
import csv
import json
from datetime import datetime

def generate_inserts(csv_file, output_file):
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        inserts = []
        
        for row in reader:
            version = row.get('version', '').strip()
            name = row.get('name', '').strip()
            statements_str = row.get('statements', '').strip()
            inserted_at = row.get('inserted_at', 'NOW()').strip()
            
            # Parse statements se for JSON array
            try:
                statements = json.loads(statements_str) if statements_str.startswith('[') else [statements_str]
            except:
                statements = [statements_str]
            
            # Formatar statements como array PostgreSQL
            statements_array = "ARRAY[" + ", ".join([f"'{s.replace("'", "''")}'" for s in statements]) + "]"
            
            # Formatar inserted_at
            if inserted_at and inserted_at != 'NOW()':
                try:
                    dt = datetime.fromisoformat(inserted_at.replace('Z', '+00:00'))
                    inserted_at_formatted = f"'{dt.isoformat()}'::timestamptz"
                except:
                    inserted_at_formatted = "NOW()"
            else:
                inserted_at_formatted = "NOW()"
            
            insert = f"('{version}', '{name.replace("'", "''")}', {statements_array}, {inserted_at_formatted})"
            inserts.append(insert)
        
        sql = f"""INSERT INTO supabase_migrations.schema_migrations (
    version,
    name,
    statements,
    inserted_at
) VALUES
{',\n'.join(inserts)}
ON CONFLICT (version) DO NOTHING;"""
        
        with open(output_file, 'w', encoding='utf-8') as out:
            out.write(sql)
        
        print(f"Gerado {len(inserts)} INSERTs em {output_file}")

if __name__ == '__main__':
    generate_inserts('migrations_rows.csv', 'migrations_inserts.sql')
*/
