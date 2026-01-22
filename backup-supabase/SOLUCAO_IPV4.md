# ✅ Soluções para Backup SEM IPv6

## 🎯 Solução 1: Pooler do Supabase (IPv4) - EM TESTE

O Supabase oferece um **pooler de conexões** que funciona via **IPv4**:

### Informações do Pooler:
- **Host:** `aws-0-sa-east-1.pooler.supabase.com`
- **Porta 5432:** Session Mode (conexões persistentes)
- **Porta 6543:** Transaction Mode (conexões curtas, serverless)
- **IPs IPv4 disponíveis:**
  - 54.94.90.106
  - 15.229.150.166
  - 52.67.1.88

### Formatos de Conexão:

**Opção A: Com PROJECT_ID no usuário**
```
postgresql://postgres.cghzttbggklhuyqxzabq:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Opção B: Usuário simples (pode não funcionar)**
```
postgresql://postgres:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### ⚠️ Nota:
O pooler pode ter **limitações** para `pg_dump` porque foi projetado para conexões de aplicações, não para backups completos. Mas vamos tentar!

---

## 🎯 Solução 2: Painel do Supabase (100% Funcional)

A forma mais garantida e **SEM necessidade de IPv6**:

1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Vá em **Settings** → **Database**
3. Ou **Database** → **Backups**
4. Procure por **"Download"** ou **"Export Database"**
5. Baixe o backup completo em formato SQL ou custom dump

**Vantagens:**
- ✅ Funciona via IPv4 (navegador)
- ✅ Interface gráfica simples
- ✅ Backup garantido pelo próprio Supabase
- ✅ Sem necessidade de configuração técnica

---

## 🎯 Solução 3: Supabase CLI com Proxy/Túnel IPv4

Se o pooler não funcionar, podemos usar um proxy ou túnel:

### Opção A: Usar ngrok ou Cloudflare Tunnel
```bash
# Criar túnel IPv4 para IPv6
# (requer configuração adicional)
```

### Opção B: Usar um servidor intermediário
Executar o backup em outro servidor que tenha acesso IPv6 e depois transferir.

---

## 🎯 Solução 4: API REST do Supabase

O Supabase oferece API REST que funciona via HTTPS (IPv4):

```bash
# Exemplo: Exportar dados via API (limitado)
curl -X GET \
  "https://cghzttbggklhuyqxzabq.supabase.co/rest/v1/" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Limitação:** API REST não permite backup completo do schema, apenas dados.

---

## 🔧 Script de Backup via Pooler IPv4

Criado em: `/root/backup-supabase/backup-pooler-ipv4.sh`

```bash
#!/bin/bash
cd /root/backup-supabase

# Tentar via pooler (porta 5432 - Session Mode)
PGPASSWORD='RR0ld40.864050!' pg_dump \
  "postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/root/backup-supabase/supabase-root.crt" \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=storage \
  --schema=auth \
  -F c \
  -f backup_completo_pooler_$(date +%Y%m%d_%H%M%S).dump \
  -v
```

---

## 📋 Comparação das Soluções

| Solução | IPv6 Necessário? | Complexidade | Funcionamento |
|---------|-----------------|--------------|---------------|
| **Painel Supabase** | ❌ Não | ⭐ Fácil | ✅ 100% |
| **Pooler IPv4** | ❌ Não | ⭐⭐ Médio | ⚠️ Pode ter limitações |
| **Supabase CLI** | ❌ Não (requer Docker) | ⭐⭐⭐ Difícil | ⚠️ Requer Docker |
| **API REST** | ❌ Não | ⭐⭐ Médio | ⚠️ Apenas dados |
| **Conexão Direta** | ✅ Sim | ⭐⭐ Médio | ❌ Não funciona aqui |

---

## ✅ Recomendação Final

**Para fazer backup AGORA sem IPv6:**

1. **Use o Painel do Supabase** (Solução 2) - É a mais garantida
2. **Se precisar automatizar**, tente o Pooler IPv4 (Solução 1) - pode funcionar

---

**Data:** $(date)
**Status:** 🔄 Testando pooler IPv4...
