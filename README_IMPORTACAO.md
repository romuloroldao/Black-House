# 📥 Importação de Dados CSV - Resumo Rápido

## 🎯 Objetivo

Importar dados dos arquivos CSV para as tabelas do Supabase:
- `migrations_rows.csv` → `supabase_migrations.schema_migrations`
- `objects_rows.csv` → `storage.objects`
- `buckets_rows.csv` → `storage.buckets`
- `prefixes_rows.csv` → `storage.prefixes`

## ⚡ Método Rápido

### 1. Copiar arquivos CSV para `/root/`

```bash
# No Windows (WSL ou Git Bash)
cp /mnt/c/Users/romul/Downloads/*_rows.csv /root/
```

### 2. Executar script Python

```bash
cd /root
python3 import_csv_data.py
```

### 3. Executar scripts SQL gerados no Supabase

No Supabase SQL Editor, execute nesta ordem:
1. `buckets_inserts.sql`
2. `migrations_inserts.sql`
3. `objects_inserts.sql`
4. `prefixes_inserts.sql`

## 📁 Arquivos Criados

- ✅ `import_csv_data.py` - Script Python principal
- ✅ `importar_dados.sh` - Script bash auxiliar
- ✅ `import_migrations.sql` - Template para migrations
- ✅ `import_objects.sql` - Template para objects
- ✅ `import_buckets.sql` - Template para buckets
- ✅ `import_prefixes.sql` - Template para prefixes
- ✅ `GUIA_IMPORTACAO.md` - Guia completo detalhado

## 🔍 Verificação

Após importar, execute:

```sql
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
SELECT COUNT(*) FROM storage.buckets;
SELECT COUNT(*) FROM storage.objects;
SELECT COUNT(*) FROM storage.prefixes;
```

## 📖 Documentação Completa

Veja `GUIA_IMPORTACAO.md` para detalhes completos.
