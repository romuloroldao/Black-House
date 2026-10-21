-- ============================================================================
-- IMPORTAR DADOS DE STORAGE BUCKETS
-- ============================================================================
-- Este script importa dados do arquivo buckets_rows.csv
-- para a tabela storage.buckets
-- ============================================================================

-- Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' 
        AND table_name = 'buckets'
    ) THEN
        RAISE EXCEPTION 'Tabela storage.buckets não existe';
    END IF;
END $$;

-- Método 1: Usando COPY (mais rápido, requer acesso ao servidor)
-- Descomente e ajuste o caminho do arquivo:
/*
COPY storage.buckets (
    id,
    name,
    owner,
    created_at,
    updated_at,
    public,
    avif_autodetection,
    file_size_limit,
    allowed_mime_types
)
FROM '/caminho/para/buckets_rows.csv'
WITH (
    FORMAT csv,
    HEADER true,
    DELIMITER ',',
    QUOTE '"',
    ESCAPE '"'
);
*/

-- Método 2: Usando INSERT (funciona via SQL Editor do Supabase)
-- IMPORTANTE: Substitua os valores abaixo pelos dados reais do seu CSV

-- Exemplo de estrutura esperada (ajuste conforme seu CSV):
-- id | name | owner | created_at | updated_at | public | avif_autodetection | file_size_limit | allowed_mime_types

-- Exemplo de INSERT (ajuste conforme necessário):
/*
INSERT INTO storage.buckets (
    id,
    name,
    owner,
    created_at,
    updated_at,
    public,
    avif_autodetection,
    file_size_limit,
    allowed_mime_types
) VALUES
-- Adicione seus dados aqui
-- Exemplo:
(
    'avatars',
    'avatars',
    NULL,
    NOW(),
    NOW(),
    true,
    false,
    5242880, -- 5MB em bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
),
(
    'fotos-alunos',
    'fotos-alunos',
    NULL,
    NOW(),
    NOW(),
    false,
    false,
    10485760, -- 10MB em bytes
    ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;
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
            bucket_id = row.get('id', '').strip()
            name = row.get('name', '').strip()
            owner = row.get('owner', 'NULL').strip()
            created_at = row.get('created_at', 'NOW()').strip()
            updated_at = row.get('updated_at', 'NOW()').strip()
            public_val = row.get('public', 'false').strip().lower()
            avif_autodetection = row.get('avif_autodetection', 'false').strip().lower()
            file_size_limit = row.get('file_size_limit', 'NULL').strip()
            allowed_mime_types_str = row.get('allowed_mime_types', '[]').strip()
            
            # Parse allowed_mime_types
            try:
                mime_types = json.loads(allowed_mime_types_str) if allowed_mime_types_str.startswith('[') else []
                mime_types_array = "ARRAY[" + ", ".join([f"'{m}'" for m in mime_types]) + "]"
            except:
                mime_types_array = "ARRAY[]::text[]"
            
            # Formatar timestamps
            def format_timestamp(ts_str):
                if not ts_str or ts_str == 'NULL' or ts_str == 'NOW()':
                    return ts_str if ts_str == 'NULL' else 'NOW()'
                try:
                    dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    return f"'{dt.isoformat()}'::timestamptz"
                except:
                    return 'NOW()'
            
            created_at_formatted = format_timestamp(created_at)
            updated_at_formatted = format_timestamp(updated_at)
            
            # Formatar valores booleanos
            public_formatted = 'true' if public_val in ('true', 't', '1', 'yes') else 'false'
            avif_formatted = 'true' if avif_autodetection in ('true', 't', '1', 'yes') else 'false'
            
            # Formatar outros valores
            owner_formatted = f"'{owner}'" if owner != 'NULL' else 'NULL'
            file_size_limit_formatted = file_size_limit if file_size_limit == 'NULL' else file_size_limit
            
            insert = f"""(
    '{bucket_id}',
    '{name}',
    {owner_formatted},
    {created_at_formatted},
    {updated_at_formatted},
    {public_formatted},
    {avif_formatted},
    {file_size_limit_formatted},
    {mime_types_array}
)"""
            inserts.append(insert)
        
        sql = f"""INSERT INTO storage.buckets (
    id,
    name,
    owner,
    created_at,
    updated_at,
    public,
    avif_autodetection,
    file_size_limit,
    allowed_mime_types
) VALUES
{',\n'.join(inserts)}
ON CONFLICT (id) DO NOTHING;"""
        
        with open(output_file, 'w', encoding='utf-8') as out:
            out.write(sql)
        
        print(f"Gerado {len(inserts)} INSERTs em {output_file}")

if __name__ == '__main__':
    generate_inserts('buckets_rows.csv', 'buckets_inserts.sql')
*/
