# 🔑 Como Obter a Connection String Correta do Pooler

## ⚠️ IMPORTANTE

A documentação oficial do Supabase recomenda **obter a connection string diretamente do painel**, pois o formato pode variar.

## 📋 Passo a Passo

### 1. Acessar o Painel do Supabase

```
https://app.supabase.com/project/cghzttbggklhuyqxzabq
```

### 2. Encontrar a Connection String

**Opção A: Botão Connect**
1. Clique no botão **"Connect"** no topo da página do projeto
2. Selecione **"Session mode"** (recomendado para backups)
3. Copie a connection string mostrada

**Opção B: Settings → Database**
1. Vá em **Settings** (ícone de engrenagem) no menu lateral
2. Clique em **Database**
3. Procure por **"Connection string"** ou **"Connection pooling"**
4. Selecione **"Session mode"**
5. Copie a connection string

### 3. Verificar o Formato

A connection string deve ser algo como:

**Session Mode (esperado):**
```
postgresql://postgres.cghzttbggklhuyqxzabq:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

Ou pode variar para:
```
postgresql://postgres.[OUTRO-FORMATO]:[PASSWORD]@[HOSTNAME]:5432/postgres
```

### 4. Atualizar o Script

Edite o arquivo `/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh` e substitua:

```bash
# Atualizar estas variáveis com a connection string do painel:
PROJECT_REF="cghzttbggklhuyqxzabq"  # Pode variar
REGION="sa-east-1"  # Verificar no painel
DB_USER_SESSION="postgres.${PROJECT_REF}"  # Pode ser diferente
POOLER_SESSION_HOST="aws-0-${REGION}.pooler.supabase.com"  # Pode variar
```

## 🔍 Verificar Região do Projeto

1. No painel do Supabase, vá em **Settings** → **General**
2. Procure por **"Region"** ou **"Location"**
3. Anote a região (ex: `sa-east-1`, `us-east-1`, etc.)

## ✅ Após Obter a Connection String

1. Execute o script atualizado:
```bash
/root/backup-supabase/backup-pooler-ipv4-CORRETO.sh
```

2. Se ainda falhar, use o backup pelo painel (100% garantido):
   - Database → Backups → Download

---

**Referência:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
