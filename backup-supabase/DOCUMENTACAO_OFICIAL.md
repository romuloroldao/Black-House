# 📚 Documentação Oficial - Backup Supabase SEM IPv6

Baseado na documentação oficial: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

## 🔍 Formatos de Conexão (Oficiais)

### 1. Pooler Session Mode (Recomendado para backups)

**Formato:**
```
postgres://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Exemplo da documentação:**
```
postgres://postgres.apbkobhfnmcqqzqeeqss:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Características:**
- ✅ Suporta IPv4 e IPv6
- ✅ Conexões persistentes
- ✅ Ideal para backups e conexões longas
- ✅ Porta: 5432

**Para seu projeto:**
- Project Ref: `cghzttbggklhuyqxzabq`
- Region: `sa-east-1`
- Connection String:
```
postgresql://postgres.cghzttbggklhuyqxzabq:RR0ld40.864050!@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### 2. Pooler Transaction Mode (Não recomendado para backups)

**Formato:**
```
postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres
```

**Características:**
- ✅ Suporta IPv4 e IPv6
- ❌ **NÃO suporta prepared statements**
- ❌ Pode ter limitações para `pg_dump`
- ⚠️ Ideal para serverless/edge functions
- ⚠️ Porta: 6543

**Para seu projeto:**
```
postgresql://postgres:RR0ld40.864050!@db.cghzttbggklhuyqxzabq.supabase.co:6543/postgres
```

**Nota:** Transaction mode pode não funcionar bem com `pg_dump` devido à falta de suporte a prepared statements.

### 3. Direct Connection (Não funciona sem IPv6)

**Formato:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Características:**
- ❌ Requer IPv6 (não funciona aqui)
- ✅ Melhor performance (sem pooler)
- ✅ Porta: 5432

## ⚠️ IMPORTANTE: Obter Connection String do Painel

**A documentação oficial recomenda:**

> "Get your project's Session pooler connection string from your project dashboard by clicking Connect."

**Por quê?**
- O formato pode variar por região/projeto
- O hostname pode ser diferente
- Pode haver configurações específicas do projeto

## 📋 Como Obter a Connection String Correta

### Passo 1: Acessar o Painel

1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Clique no botão **"Connect"** no topo da página
3. Ou vá em **Settings** → **Database** → **Connection String**

### Passo 2: Selecionar o Tipo de Conexão

Escolha **"Session mode"** para backups:
- É o modo recomendado para conexões persistentes
- Funciona melhor com `pg_dump`

### Passo 3: Copiar a Connection String

Copie a connection string **EXATA** mostrada no painel e use no script.

## 🔧 Script Atualizado

O script `/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh` está atualizado com:

1. ✅ Formato correto baseado na documentação oficial
2. ✅ Tentativa via Session Mode primeiro (porta 5432)
3. ✅ Fallback para Transaction Mode (porta 6543) se necessário
4. ✅ Avisos sobre limitações

## ⚠️ Problema Atual: "Tenant or user not found"

Se você ainda receber este erro, significa que:

1. **A connection string pode estar diferente** - Verifique no painel
2. **O pooler pode não estar habilitado** para seu projeto
3. **A região pode estar incorreta** - Verifique qual região seu projeto usa
4. **Pode precisar usar IPv4 add-on** (se disponível)

## ✅ Solução Garantida: Painel do Supabase

Se o pooler não funcionar, use o **Painel do Supabase** para fazer o backup:

1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Vá em **Database** → **Backups**
3. Ou **Settings** → **Database** → **Export**
4. Baixe o backup completo

**Vantagens:**
- ✅ 100% funcional
- ✅ Sem necessidade de IPv6
- ✅ Sem configuração técnica
- ✅ Backup garantido pelo Supabase

## 📊 Comparação dos Métodos

| Método | IPv6 Necessário? | pg_dump Funciona? | Recomendado? |
|--------|-----------------|-------------------|--------------|
| **Direct Connection** | ✅ Sim | ✅ Sim | ❌ Não (sem IPv6) |
| **Session Mode Pooler** | ❌ Não | ✅ Sim | ✅ **SIM** |
| **Transaction Mode Pooler** | ❌ Não | ⚠️ Pode falhar | ⚠️ Não ideal |
| **Painel Supabase** | ❌ Não | N/A | ✅ **SIM** (backup manual) |

## 🎯 Recomendação Final

**Para fazer backup AGORA:**

1. **Primeiro:** Verifique a connection string EXATA no painel
2. **Segundo:** Use o script `/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh`
3. **Se falhar:** Use o Painel do Supabase para download manual

**Para automatizar no futuro:**

1. Configure o script com a connection string correta do painel
2. Execute periodicamente via cron
3. Ou use o painel quando necessário

---

**Referência Oficial:**
https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

**Data:** $(date)
**Status:** ⚠️ Aguardando verificação da connection string no painel
