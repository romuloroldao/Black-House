-- ============================================================================
-- IMPORTAR DADOS DE STORAGE OBJECTS
-- ============================================================================
-- Este script importa dados do arquivo objects_rows.csv
-- para a tabela storage.objects
-- ============================================================================

-- Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' 
        AND table_name = 'objects'
    ) THEN
        RAISE EXCEPTION 'Tabela storage.objects não existe';
    END IF;
END $$;

-- Método 1: Usando COPY (mais rápido, requer acesso ao servidor)
-- Descomente e ajuste o caminho do arquivo:
/*
COPY storage.objects (
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata,
    path_tokens,
    version,
    owner_id
)
FROM '/caminho/para/objects_rows.csv'
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
-- id | bucket_id | name | owner | created_at | updated_at | last_accessed_at | metadata | path_tokens | version | owner_id

-- Exemplo de INSERT (ajuste conforme necessário):
/*
INSERT INTO storage.objects (
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata,
    path_tokens,
    version,
    owner_id
) VALUES
-- Adicione seus dados aqui
-- Exemplo:
(
    gen_random_uuid(),
    'avatars',
    'user123/avatar.jpg',
    auth.uid(),
    NOW(),
    NOW(),
    NOW(),
    '{"size": 1024, "mimetype": "image/jpeg"}'::jsonb,
    ARRAY['user123', 'avatar.jpg'],
    NULL,
    auth.uid()
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
import uuid
from datetime import datetime

def generate_inserts(csv_file, output_file):
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        inserts = []
        
        for row in reader:
            obj_id = row.get('id', '').strip() or f"gen_random_uuid()"
            bucket_id = row.get('bucket_id', '').strip()
            name = row.get('name', '').strip()
            owner = row.get('owner', '').strip() or 'NULL'
            created_at = row.get('created_at', 'NOW()').strip()
            updated_at = row.get('updated_at', 'NOW()').strip()
            last_accessed_at = row.get('last_accessed_at', 'NULL').strip()
            metadata_str = row.get('metadata', '{}').strip()
            path_tokens_str = row.get('path_tokens', '[]').strip()
            version = row.get('version', 'NULL').strip()
            owner_id = row.get('owner_id', 'NULL').strip()
            
            # Parse metadata
            try:
                metadata = json.loads(metadata_str) if metadata_str else {}
                metadata_formatted = f"'{json.dumps(metadata)}'::jsonb"
            except:
                metadata_formatted = "'{}'::jsonb"
            
            # Parse path_tokens
            try:
                path_tokens = json.loads(path_tokens_str) if path_tokens_str.startswith('[') else []
                path_tokens_array = "ARRAY[" + ", ".join([f"'{t}'" for t in path_tokens]) + "]"
            except:
                path_tokens_array = "ARRAY[]::text[]"
            
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
            last_accessed_at_formatted = format_timestamp(last_accessed_at) if last_accessed_at != 'NULL' else 'NULL'
            
            # Formatar valores
            obj_id_formatted = f"'{obj_id}'" if obj_id != 'gen_random_uuid()' else obj_id
            bucket_id_formatted = f"'{bucket_id}'"
            name_formatted = f"'{name.replace("'", "''")}'"
            owner_formatted = f"'{owner}'" if owner != 'NULL' else 'NULL'
            version_formatted = version if version == 'NULL' else f"'{version}'"
            owner_id_formatted = f"'{owner_id}'" if owner_id != 'NULL' else 'NULL'
            
            insert = f"""(
    {obj_id_formatted},
    {bucket_id_formatted},
    {name_formatted},
    {owner_formatted},
    {created_at_formatted},
    {updated_at_formatted},
    {last_accessed_at_formatted},
    {metadata_formatted},
    {path_tokens_array},
    {version_formatted},
    {owner_id_formatted}
)"""
            inserts.append(insert)
        
        sql = f"""INSERT INTO storage.objects (
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata,
    path_tokens,
    version,
    owner_id
) VALUES
{',\n'.join(inserts)}
ON CONFLICT (id) DO NOTHING;"""
        
        with open(output_file, 'w', encoding='utf-8') as out:
            out.write(sql)
        
        print(f"Gerado {len(inserts)} INSERTs em {output_file}")

if __name__ == '__main__':
    generate_inserts('objects_rows.csv', 'objects_inserts.sql')
*/
