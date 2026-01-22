#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para importar dados CSV para tabelas do Supabase
Gera scripts SQL com INSERTs baseados nos arquivos CSV fornecidos
"""

import csv
import json
import uuid
import sys
from datetime import datetime
from pathlib import Path

def format_timestamp(ts_str):
    """Formata timestamp para formato PostgreSQL"""
    if not ts_str or ts_str.strip() == '' or ts_str.strip().upper() == 'NULL':
        return 'NULL'
    if ts_str.strip().upper() == 'NOW()':
        return 'NOW()'
    try:
        # Tentar vários formatos
        for fmt in [
            '%Y-%m-%d %H:%M:%S.%f%z',
            '%Y-%m-%d %H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S.%f%z',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
        ]:
            try:
                dt = datetime.strptime(ts_str.replace('Z', '+00:00'), fmt)
                return f"'{dt.isoformat()}'::timestamptz"
            except:
                continue
        # Se nenhum formato funcionar, retornar como string
        return f"'{ts_str}'::timestamptz"
    except:
        return f"'{ts_str}'::timestamptz"

def escape_sql_string(value):
    """Escapa strings para SQL"""
    if value is None:
        return 'NULL'
    return str(value).replace("'", "''")

def generate_migrations_inserts(csv_file, output_file):
    """Gera INSERTs para supabase_migrations.schema_migrations"""
    inserts = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            version = row.get('version', '').strip()
            name = row.get('name', '').strip()
            statements_str = row.get('statements', '').strip()
            inserted_at = row.get('inserted_at', '').strip()
            
            # Parse statements
            try:
                if statements_str.startswith('['):
                    statements = json.loads(statements_str)
                else:
                    statements = [statements_str] if statements_str else []
            except:
                statements = [statements_str] if statements_str else []
            
            statements_array = "ARRAY[" + ", ".join([f"'{escape_sql_string(s)}'" for s in statements]) + "]"
            inserted_at_formatted = format_timestamp(inserted_at) if inserted_at else 'NOW()'
            
            insert = f"('{version}', '{escape_sql_string(name)}', {statements_array}, {inserted_at_formatted})"
            inserts.append(insert)
    
    header = "-- ============================================================================\n"
    header += "-- INSERTS PARA supabase_migrations.schema_migrations\n"
    header += f"-- Gerado automaticamente a partir de {csv_file.name}\n"
    header += "-- ============================================================================\n\n"
    
    sql = header + """INSERT INTO supabase_migrations.schema_migrations (
    version,
    name,
    statements,
    inserted_at
) VALUES
""" + ',\n'.join(inserts) + """
ON CONFLICT (version) DO NOTHING;
"""
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(sql)
    
    print(f"✅ Gerado {len(inserts)} INSERTs para migrations em {output_file}")
    return len(inserts)

def generate_objects_inserts(csv_file, output_file):
    """Gera INSERTs para storage.objects"""
    inserts = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            obj_id = row.get('id', '').strip()
            bucket_id = row.get('bucket_id', '').strip()
            name = row.get('name', '').strip()
            owner = row.get('owner', '').strip()
            created_at = row.get('created_at', '').strip()
            updated_at = row.get('updated_at', '').strip()
            last_accessed_at = row.get('last_accessed_at', '').strip()
            metadata_str = row.get('metadata', '{}').strip()
            path_tokens_str = row.get('path_tokens', '[]').strip()
            version = row.get('version', '').strip()
            owner_id = row.get('owner_id', '').strip()
            
            # Parse metadata
            try:
                metadata = json.loads(metadata_str) if metadata_str else {}
                metadata_formatted = f"'{json.dumps(metadata)}'::jsonb"
            except:
                metadata_formatted = "'{}'::jsonb"
            
            # Parse path_tokens
            try:
                if path_tokens_str.startswith('['):
                    path_tokens = json.loads(path_tokens_str)
                else:
                    path_tokens = []
                path_tokens_array = "ARRAY[" + ", ".join([f"'{escape_sql_string(t)}'" for t in path_tokens]) + "]"
            except:
                path_tokens_array = "ARRAY[]::text[]"
            
            # Formatar valores
            obj_id_formatted = f"'{obj_id}'" if obj_id else "gen_random_uuid()"
            bucket_id_formatted = f"'{bucket_id}'"
            name_formatted = f"'{escape_sql_string(name)}'"
            owner_formatted = f"'{owner}'" if owner else 'NULL'
            version_formatted = f"'{version}'" if version else 'NULL'
            owner_id_formatted = f"'{owner_id}'" if owner_id else 'NULL'
            
            created_at_formatted = format_timestamp(created_at) if created_at else 'NOW()'
            updated_at_formatted = format_timestamp(updated_at) if updated_at else 'NOW()'
            last_accessed_at_formatted = format_timestamp(last_accessed_at) if last_accessed_at else 'NULL'
            
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
    
    header = "-- ============================================================================\n"
    header += "-- INSERTS PARA storage.objects\n"
    header += f"-- Gerado automaticamente a partir de {csv_file.name}\n"
    header += "-- ============================================================================\n\n"
    
    sql = header + """INSERT INTO storage.objects (
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
""" + ',\n'.join(inserts) + """
ON CONFLICT (id) DO NOTHING;
"""
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(sql)
    
    print(f"✅ Gerado {len(inserts)} INSERTs para objects em {output_file}")
    return len(inserts)

def generate_buckets_inserts(csv_file, output_file):
    """Gera INSERTs para storage.buckets"""
    inserts = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            bucket_id = row.get('id', '').strip()
            name = row.get('name', '').strip()
            owner = row.get('owner', '').strip()
            created_at = row.get('created_at', '').strip()
            updated_at = row.get('updated_at', '').strip()
            public_val = row.get('public', 'false').strip().lower()
            avif_autodetection = row.get('avif_autodetection', 'false').strip().lower()
            file_size_limit = row.get('file_size_limit', '').strip()
            allowed_mime_types_str = row.get('allowed_mime_types', '[]').strip()
            
            # Parse allowed_mime_types
            try:
                if allowed_mime_types_str.startswith('['):
                    mime_types = json.loads(allowed_mime_types_str)
                else:
                    mime_types = []
                mime_types_array = "ARRAY[" + ", ".join([f"'{escape_sql_string(m)}'" for m in mime_types]) + "]"
            except:
                mime_types_array = "ARRAY[]::text[]"
            
            # Formatar valores booleanos
            public_formatted = 'true' if public_val in ('true', 't', '1', 'yes') else 'false'
            avif_formatted = 'true' if avif_autodetection in ('true', 't', '1', 'yes') else 'false'
            
            # Formatar outros valores
            owner_formatted = f"'{owner}'" if owner else 'NULL'
            file_size_limit_formatted = file_size_limit if file_size_limit else 'NULL'
            
            created_at_formatted = format_timestamp(created_at) if created_at else 'NOW()'
            updated_at_formatted = format_timestamp(updated_at) if updated_at else 'NOW()'
            
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
    
    header = "-- ============================================================================\n"
    header += "-- INSERTS PARA storage.buckets\n"
    header += f"-- Gerado automaticamente a partir de {csv_file.name}\n"
    header += "-- ============================================================================\n\n"
    
    sql = header + """INSERT INTO storage.buckets (
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
""" + ',\n'.join(inserts) + """
ON CONFLICT (id) DO NOTHING;
"""
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(sql)
    
    print(f"✅ Gerado {len(inserts)} INSERTs para buckets em {output_file}")
    return len(inserts)

def generate_prefixes_inserts(csv_file, output_file):
    """Gera INSERTs para storage.prefixes"""
    inserts = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            prefix_id = row.get('id', '').strip()
            bucket_id = row.get('bucket_id', '').strip()
            prefix = row.get('prefix', '').strip()
            created_at = row.get('created_at', '').strip()
            updated_at = row.get('updated_at', '').strip()
            
            prefix_id_formatted = f"'{prefix_id}'" if prefix_id else "gen_random_uuid()"
            bucket_id_formatted = f"'{bucket_id}'"
            prefix_formatted = f"'{escape_sql_string(prefix)}'"
            
            created_at_formatted = format_timestamp(created_at) if created_at else 'NOW()'
            updated_at_formatted = format_timestamp(updated_at) if updated_at else 'NOW()'
            
            insert = f"""(
    {prefix_id_formatted},
    {bucket_id_formatted},
    {prefix_formatted},
    {created_at_formatted},
    {updated_at_formatted}
)"""
            inserts.append(insert)
    
    header = "-- ============================================================================\n"
    header += "-- INSERTS PARA storage.prefixes\n"
    header += f"-- Gerado automaticamente a partir de {csv_file.name}\n"
    header += "-- ============================================================================\n\n"
    
    sql = header + """INSERT INTO storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at
) VALUES
""" + ',\n'.join(inserts) + """
ON CONFLICT (id) DO NOTHING;
"""
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(sql)
    
    print(f"✅ Gerado {len(inserts)} INSERTs para prefixes em {output_file}")
    return len(inserts)

def main():
    """Função principal"""
    print("=" * 70)
    print("GERADOR DE SCRIPTS SQL PARA IMPORTAÇÃO DE DADOS CSV")
    print("=" * 70)
    print()
    
    # Caminhos dos arquivos CSV (ajuste conforme necessário)
    base_path = Path(".")
    csv_files = {
        'migrations': base_path / 'migrations_rows.csv',
        'objects': base_path / 'objects_rows.csv',
        'buckets': base_path / 'buckets_rows.csv',
        'prefixes': base_path / 'prefixes_rows.csv',
    }
    
    # Verificar quais arquivos existem
    available_files = {}
    for key, path in csv_files.items():
        if path.exists():
            available_files[key] = path
            print(f"✓ Encontrado: {path}")
        else:
            print(f"✗ Não encontrado: {path}")
    
    if not available_files:
        print("\n❌ Nenhum arquivo CSV encontrado!")
        print("\nColoque os arquivos CSV no mesmo diretório do script:")
        print("  - migrations_rows.csv")
        print("  - objects_rows.csv")
        print("  - buckets_rows.csv")
        print("  - prefixes_rows.csv")
        return 1
    
    print()
    print("Gerando scripts SQL...")
    print()
    
    # Gerar scripts para cada arquivo encontrado
    total_inserts = 0
    
    if 'migrations' in available_files:
        count = generate_migrations_inserts(
            available_files['migrations'],
            base_path / 'migrations_inserts.sql'
        )
        total_inserts += count
    
    if 'objects' in available_files:
        count = generate_objects_inserts(
            available_files['objects'],
            base_path / 'objects_inserts.sql'
        )
        total_inserts += count
    
    if 'buckets' in available_files:
        count = generate_buckets_inserts(
            available_files['buckets'],
            base_path / 'buckets_inserts.sql'
        )
        total_inserts += count
    
    if 'prefixes' in available_files:
        count = generate_prefixes_inserts(
            available_files['prefixes'],
            base_path / 'prefixes_inserts.sql'
        )
        total_inserts += count
    
    print()
    print("=" * 70)
    print(f"✅ Concluído! Total de {total_inserts} INSERTs gerados")
    print("=" * 70)
    print()
    print("Próximos passos:")
    print("1. Revise os arquivos SQL gerados (*_inserts.sql)")
    print("2. Execute os scripts no Supabase SQL Editor")
    print("3. Verifique se os dados foram importados corretamente")
    print()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
