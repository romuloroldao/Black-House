# 📤 Como Exportar Dados do Supabase

## Opção 1: Usando pg_dump (Recomendado)

Para exportar schema e dados completos, você precisa da **senha do PostgreSQL** do Supabase.

### Obter a Senha do PostgreSQL

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto: `cghzttbggklhuyqxzabq`
3. Vá em **Settings** → **Database**
4. Procure por **"Connection string"** ou **"Connection pooling"**
5. A senha está na string de conexão ou você pode resetá-la

### Executar Exportação

```bash
# Definir senha do PostgreSQL do Supabase
export SUPABASE_PASSWORD='sua_senha_postgresql_aqui'

# Executar script
cd /root
./scripts/export-supabase.sh
```

O script irá:
- Exportar schema público (estrutura)
- Exportar dados
- Salvar em `./backup/`

## Opção 2: Usando Supabase CLI

Se você tem o Supabase CLI instalado:

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Login
npx supabase login

# Exportar
npx supabase db dump --project-ref cghzttbggklhuyqxzabq > backup/schema_supabase.sql
```

## Opção 3: Via Dashboard do Supabase

1. Acesse o dashboard
2. Vá em **Database** → **Backups**
3. Crie um backup manual
4. Baixe o arquivo SQL

## ⚠️ Importante

- A senha do PostgreSQL é **diferente** da Service Role Key
- A Service Role Key não funciona com `pg_dump`
- Você precisa da senha real do banco de dados PostgreSQL

## 📋 Após Exportar

1. Os arquivos estarão em `/root/backup/`:
   - `schema_public.sql` - Estrutura das tabelas
   - `data.sql` - Dados
   - `schema_completo.sql` - Schema completo (referência)

2. Adaptar schema:
   ```bash
   ./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
   ```

3. Importar no PostgreSQL local:
   ```bash
   psql -U app_user -d blackhouse_db -f backup/schema_public_adapted.sql
   psql -U app_user -d blackhouse_db -f backup/data.sql
   ```
