-- ============================================================================
-- IMPORTAR DADOS DE STORAGE PREFIXES
-- ============================================================================
-- Este script importa dados do arquivo prefixes_rows.csv
-- para a tabela storage.prefixes
-- ============================================================================

-- Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' 
        AND table_name = 'prefixes'
    ) THEN
        RAISE EXCEPTION 'Tabela storage.prefixes não existe';
    END IF;
END $$;

-- Método 1: Usando COPY (mais rápido, requer acesso ao servidor)
-- Descomente e ajuste o caminho do arquivo:
/*
COPY storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at
)
FROM '/caminho/para/prefixes_rows.csv'
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
-- id | bucket_id | prefix | created_at | updated_at

-- Exemplo de INSERT (ajuste conforme necessário):
/*
INSERT INTO storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at
) VALUES
-- Adicione seus dados aqui
-- Exemplo:
(
    gen_random_uuid(),
    'avatars',
    'user123/',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- SCRIPT PYTHON PARA GERAR INSERTS AUTOMATICAMENTE
-- ============================================================================
-- Execute este script Python para gerar os INSERTs automaticamente:
/*
import csv
from datetime import datetime

def generate_inserts(csv_file, output_file):
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        inserts = []
        
        for row in reader:
            prefix_id = row.get('id', '').strip() or f"gen_random_uuid()"
            bucket_id = row.get('bucket_id', '').strip()
            prefix = row.get('prefix', '').strip()
            created_at = row.get('created_at', 'NOW()').strip()
            updated_at = row.get('updated_at', 'NOW()').strip()
            
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
            
            # Formatar valores
            prefix_id_formatted = f"'{prefix_id}'" if prefix_id != 'gen_random_uuid()' else prefix_id
            bucket_id_formatted = f"'{bucket_id}'"
            prefix_formatted = f"'{prefix.replace("'", "''")}'"
            
            insert = f"""(
    {prefix_id_formatted},
    {bucket_id_formatted},
    {prefix_formatted},
    {created_at_formatted},
    {updated_at_formatted}
)"""
            inserts.append(insert)
        
        sql = f"""INSERT INTO storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at
) VALUES
{',\n'.join(inserts)}
ON CONFLICT (id) DO NOTHING;"""
        
        with open(output_file, 'w', encoding='utf-8') as out:
            out.write(sql)
        
        print(f"Gerado {len(inserts)} INSERTs em {output_file}")

if __name__ == '__main__':
    generate_inserts('prefixes_rows.csv', 'prefixes_inserts.sql')
*/
