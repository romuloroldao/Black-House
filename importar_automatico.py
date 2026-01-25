#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script SIMPLIFICADO para importar dados CSV
Basta executar: python3 importar_automatico.py
"""

import csv
import json
import sys
from pathlib import Path

def main():
    print("=" * 70)
    print("IMPORTAÇÃO AUTOMÁTICA DE DADOS CSV")
    print("=" * 70)
    print()
    
    # Tentar encontrar os arquivos CSV
    possiveis_locais = [
        Path("/mnt/c/Users/romul/Downloads"),
        Path("/root"),
        Path("."),
        Path.home() / "Downloads",
    ]
    
    arquivos_csv = {
        'migrations': None,
        'objects': None,
        'buckets': None,
        'prefixes': None,
    }
    
    print("Procurando arquivos CSV...")
    print()
    
    # Procurar arquivos
    for local in possiveis_locais:
        if local.exists():
            for arquivo in local.glob("*_rows.csv"):
                nome = arquivo.name.lower()
                if 'migration' in nome:
                    arquivos_csv['migrations'] = arquivo
                    print(f"✓ Encontrado: {arquivo}")
                elif 'object' in nome:
                    arquivos_csv['objects'] = arquivo
                    print(f"✓ Encontrado: {arquivo}")
                elif 'bucket' in nome:
                    arquivos_csv['buckets'] = arquivo
                    print(f"✓ Encontrado: {arquivo}")
                elif 'prefix' in nome:
                    arquivos_csv['prefixes'] = arquivo
                    print(f"✓ Encontrado: {arquivo}")
    
    print()
    
    # Verificar se encontrou algum arquivo
    arquivos_encontrados = [a for a in arquivos_csv.values() if a]
    
    if not arquivos_encontrados:
        print("❌ Nenhum arquivo CSV encontrado!")
        print()
        print("Por favor, copie os arquivos CSV para um destes locais:")
        print("  - /root/")
        print("  - Diretório atual")
        print("  - Ou me diga onde estão os arquivos")
        print()
        print("Arquivos necessários:")
        print("  - migrations_rows.csv")
        print("  - objects_rows.csv")
        print("  - buckets_rows.csv")
        print("  - prefixes_rows.csv")
        return 1
    
    print(f"✅ Encontrados {len(arquivos_encontrados)} arquivo(s)")
    print()
    print("Para continuar, preciso que você:")
    print("1. Copie os arquivos CSV para: /root/")
    print("2. Ou me envie o conteúdo dos arquivos CSV")
    print()
    print("Ou posso criar um script que você executa diretamente no Supabase!")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
