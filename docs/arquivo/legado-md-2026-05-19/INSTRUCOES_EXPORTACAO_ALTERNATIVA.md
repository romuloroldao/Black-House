# 📤 Instruções de Exportação Alternativa

## ⚠️ Situação

A VPS não consegue conectar diretamente ao Supabase devido a problemas de rede (IPv6/firewall).

## ✅ Solução: Exportar Localmente e Transferir

### Passo 1: Exportar no Seu Computador Local

Escolha uma das opções abaixo:

#### Opção A: Supabase CLI (Recomendado)

```bash
# No seu computador (não na VPS)
npm install -g supabase

# Login
npx supabase login

# Exportar schema
npx supabase db dump --project-ref cghzttbggklhuyqxzabq --schema public > schema_public.sql

# Exportar dados (se possível)
npx supabase db dump --project-ref cghzttbggklhuyqxzabq --data-only > data.sql
```

#### Opção B: pg_dump Local

```bash
# No seu computador local
export SUPABASE_PASSWORD='RR0ld40.864050!'

# Exportar schema
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=vault \
  > schema_public.sql

# Exportar dados
pg_dump "postgresql://postgres:${SUPABASE_PASSWORD}@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  > data.sql
```

#### Opção C: Via Dashboard

1. Acesse: https://supabase.com/dashboard
2. Projeto: `cghzttbggklhuyqxzabq`
3. Vá em: **Database → Backups**
4. Crie ou baixe backup
5. Salve como `schema_public.sql` e `data.sql`

### Passo 2: Transferir para a VPS

```bash
# Do seu computador para a VPS
scp schema_public.sql root@177.153.64.95:/root/backup/
scp data.sql root@177.153.64.95:/root/backup/
```

Ou use SFTP, rsync, ou qualquer método de transferência de arquivos.

### Passo 3: Na VPS - Preparar e Importar

```bash
# Conectar na VPS
ssh root@177.153.64.95

# Preparar importação
cd /root
./scripts/preparar-importacao.sh

# Importar dados
./scripts/importar-dados.sh
```

## 📋 Credenciais para Referência

**String de Conexão:**
```
postgresql://postgres:RR0ld40.864050!@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres
```

**Informações:**
- Host: `db.cghzttbggklhuyqxzabq.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `RR0ld40.864050!`

## ✅ Checklist

- [ ] Arquivos exportados localmente
- [ ] Arquivos transferidos para VPS em `/root/backup/`
- [ ] Executado `preparar-importacao.sh`
- [ ] Executado `importar-dados.sh`
- [ ] Dados verificados no PostgreSQL local

## 🔍 Verificar Importação

```bash
# Na VPS
PGPASSWORD='temp_password_change_me_123!' psql -h localhost -U app_user -d blackhouse_db -c "\dt public.*"
```

---

**Nota**: A senha foi salva com segurança. Use qualquer método acima para exportar os dados.
