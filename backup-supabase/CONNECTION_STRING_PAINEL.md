# 📋 Connection Strings do Painel do Supabase

Baseado na imagem do painel do Supabase, aqui estão os formatos corretos:

## 🔍 Formatos Identificados no Painel

### 1. Direct Connection
**Para:** `pg_dump`, `psql`, etc.

```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

**Características:**
- ⚠️ **Requires IPv6 or Pooler** (não funciona sem IPv6 aqui)
- Porta: 5432
- Host: `db.xxxxx.supabase.co` (onde xxxx = project ref)

**Para seu projeto:**
```
postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres
```

---

### 2. Session Mode (RECOMENDADO para backups) ✅

**Para:** Server-side apps (long-lived clients)

```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

**Características:**
- ✅ Suporta IPv4 e IPv6
- ✅ Conexões persistentes
- ✅ **Ideal para backups com pg_dump**
- ✅ Porta: 5432
- ✅ Region: `sa-east-1` (South America East - São Paulo)

**Para seu projeto:**
```
postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

---

### 3. Transaction Mode

**Para:** Serverless/Edge Functions (short-lived clients)

```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Características:**
- ✅ Suporta IPv4 e IPv6
- ❌ **NÃO suporta prepared statements**
- ⚠️ Pode ter limitações para `pg_dump`
- ⚠️ Porta: 6543
- ⚠️ Ideal para serverless, não para backups

**Para seu projeto:**
```
postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

---

## ✅ Recomendação para Backup

**Use Session Mode (porta 5432):**

```bash
PGPASSWORD='RR0ld40.864050!' pg_dump \
  "postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/root/backup-supabase/supabase-root.crt" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  -F c \
  -f backup_completo.dump \
  -v
```

## 📋 Informações do Projeto

- **Project Reference:** `cghzttbggklhuyqxzabq`
- **Region:** `sa-east-1` (South America East - São Paulo)
- **Password:** `RR0ld40.864050!`
- **Database:** `postgres`

## ⚠️ Notas Importantes

1. **Formato de usuário:** Todas as connection strings usam `postgres.xxxxx` (com ponto)
2. **Region:** Confirmado como `sa-east-1` no painel
3. **Session Mode:** É o recomendado para backups (conexões persistentes)
4. **Direct Connection:** Requer IPv6, não funciona aqui sem configuração adicional

## 🔧 Script Atualizado

O script `/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh` já está configurado com esses valores!

Para executar:
```bash
/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh
```

---

**Data:** $(date)
**Status:** ✅ Formatos confirmados do painel
