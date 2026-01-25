# 📥 Guia de Importação de Dados CSV

Este guia explica como importar os dados dos arquivos CSV para as tabelas do Supabase.

## 📋 Arquivos Necessários

Você precisa dos seguintes arquivos CSV:
- `migrations_rows.csv` → Tabela `supabase_migrations.schema_migrations`
- `objects_rows.csv` → Tabela `storage.objects`
- `buckets_rows.csv` → Tabela `storage.buckets`
- `prefixes_rows.csv` → Tabela `storage.prefixes`

## 🚀 Método 1: Usando o Script Python (Recomendado)

### Passo 1: Preparar os Arquivos

Coloque os arquivos CSV no mesmo diretório do script `import_csv_data.py`:

```
/root/
├── import_csv_data.py
├── migrations_rows.csv
├── objects_rows.csv
├── buckets_rows.csv
└── prefixes_rows.csv
```

### Passo 2: Executar o Script

**Opção A: Usando o script bash**
```bash
chmod +x importar_dados.sh
./importar_dados.sh
```

**Opção B: Executando Python diretamente**
```bash
python3 import_csv_data.py
```

### Passo 3: Executar os Scripts SQL Gerados

O script Python gerará os seguintes arquivos SQL:
- `migrations_inserts.sql`
- `objects_inserts.sql`
- `buckets_inserts.sql`
- `prefixes_inserts.sql`

Execute cada arquivo no **Supabase SQL Editor**:

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Abra cada arquivo `.sql` gerado
4. Execute o script
5. Verifique se os dados foram importados

---

## 🔧 Método 2: Importação Manual

Se preferir fazer manualmente ou ajustar os dados:

### 1. Migrations

Abra `import_migrations.sql` e siga as instruções para:
- Usar `COPY` (se tiver acesso ao servidor)
- Ou gerar INSERTs manualmente

### 2. Objects

Abra `import_objects.sql` e siga as instruções.

### 3. Buckets

Abra `import_buckets.sql` e siga as instruções.

### 4. Prefixes

Abra `import_prefixes.sql` e siga as instruções.

---

## 📊 Estrutura Esperada dos CSVs

### migrations_rows.csv
```csv
version,name,statements,inserted_at
20240101000000,initial_schema,"[""CREATE TABLE...""]",2024-01-01T00:00:00Z
```

### objects_rows.csv
```csv
id,bucket_id,name,owner,created_at,updated_at,last_accessed_at,metadata,path_tokens,version,owner_id
uuid-here,avatars,user123/avatar.jpg,NULL,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,NULL,"{""size"":1024}",[""user123"",""avatar.jpg""],NULL,NULL
```

### buckets_rows.csv
```csv
id,name,owner,created_at,updated_at,public,avif_autodetection,file_size_limit,allowed_mime_types
avatars,avatars,NULL,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,true,false,5242880,"[""image/jpeg"",""image/png""]"
```

### prefixes_rows.csv
```csv
id,bucket_id,prefix,created_at,updated_at
uuid-here,avatars,user123/,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z
```

---

## ⚠️ Importante

### Ordem de Importação

Execute os scripts nesta ordem:

1. **buckets_inserts.sql** (primeiro, pois objects dependem de buckets)
2. **migrations_inserts.sql**
3. **objects_inserts.sql** (depende de buckets)
4. **prefixes_inserts.sql** (depende de buckets)

### Conflitos

Todos os scripts usam `ON CONFLICT DO NOTHING`, então:
- Dados duplicados serão ignorados
- Não haverá erros se executar múltiplas vezes
- Dados existentes não serão sobrescritos

### Validação

Após importar, valide os dados:

```sql
-- Verificar migrations
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;

-- Verificar buckets
SELECT id, name, public FROM storage.buckets;

-- Verificar objects
SELECT COUNT(*) FROM storage.objects;

-- Verificar prefixes
SELECT COUNT(*) FROM storage.prefixes;
```

---

## 🐛 Solução de Problemas

### Erro: "Tabela não existe"

Certifique-se de que as tabelas existem no Supabase:
- `supabase_migrations.schema_migrations` (criada automaticamente)
- `storage.buckets` (criada automaticamente)
- `storage.objects` (criada automaticamente)
- `storage.prefixes` (criada automaticamente)

### Erro: "Formato de data inválido"

O script Python tenta vários formatos de data. Se houver erro:
1. Verifique o formato das datas no CSV
2. Ajuste a função `format_timestamp()` no script Python

### Erro: "JSON inválido"

Se houver erro ao parsear JSON:
1. Verifique se os campos JSON estão bem formatados
2. Use `NULL` ou `{}` para valores vazios

### Erro: "Caractere especial"

O script escapa aspas simples automaticamente. Se houver problemas:
1. Verifique caracteres especiais nos dados
2. Ajuste a função `escape_sql_string()` se necessário

---

## 📝 Exemplo de Uso Completo

```bash
# 1. Copiar arquivos CSV para o diretório
cp /caminho/para/*.csv /root/

# 2. Executar script Python
python3 import_csv_data.py

# 3. Verificar arquivos gerados
ls -la *_inserts.sql

# 4. Executar no Supabase SQL Editor (ordem importante)
# - buckets_inserts.sql
# - migrations_inserts.sql
# - objects_inserts.sql
# - prefixes_inserts.sql
```

---

## 🔍 Verificação Pós-Importação

Execute estas queries para verificar:

```sql
-- Contar registros importados
SELECT 
    'migrations' as tabela,
    COUNT(*) as total
FROM supabase_migrations.schema_migrations
UNION ALL
SELECT 
    'buckets' as tabela,
    COUNT(*) as total
FROM storage.buckets
UNION ALL
SELECT 
    'objects' as tabela,
    COUNT(*) as total
FROM storage.objects
UNION ALL
SELECT 
    'prefixes' as tabela,
    COUNT(*) as total
FROM storage.prefixes;

-- Verificar buckets criados
SELECT id, name, public, created_at 
FROM storage.buckets 
ORDER BY created_at;

-- Verificar objetos por bucket
SELECT bucket_id, COUNT(*) as total_objects
FROM storage.objects
GROUP BY bucket_id;
```

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do script Python
2. Revise os arquivos SQL gerados
3. Execute queries de validação
4. Verifique a documentação do Supabase

---

**Última atualização:** Data atual  
**Versão:** 1.0
