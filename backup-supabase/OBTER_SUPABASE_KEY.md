# 🔑 Como Obter a SUPABASE_KEY para Backup via API

## 📋 Passo a Passo

### 1. Acessar o Painel do Supabase

```
https://app.supabase.com/project/cghzttbggklhuyqxzabq
```

### 2. Obter a Chave da API

**Opção A: Anon Key (pública, limitada)**
1. Vá em **Settings** (ícone de engrenagem) no menu lateral
2. Clique em **API**
3. Procure por **"anon public"** ou **"anon key"**
4. Copie a chave

**Opção B: Service Role Key (privada, acesso completo) - RECOMENDADO**
1. Vá em **Settings** → **API**
2. Procure por **"service_role"** ou **"service_role key"**
3. ⚠️ **CUIDADO:** Esta chave tem acesso total ao banco!
4. Copie a chave

### 3. Configurar a Chave

**Opção 1: Variável de Ambiente (Recomendado)**
```bash
export SUPABASE_KEY="sua-chave-aqui"
```

**Opção 2: Adicionar no Script**
Edite `/root/backup-supabase/backup-via-api-rest.js` e adicione:
```javascript
const SUPABASE_KEY = 'sua-chave-aqui';
```

### 4. Executar o Backup

```bash
/root/backup-supabase/backup-via-api-rest.sh
```

## ⚠️ IMPORTANTE: Limitações da API REST

A API REST do Supabase **NÃO** é adequada para backup completo porque:

- ❌ **Só exporta DADOS** (registros das tabelas)
- ❌ **NÃO exporta estrutura** (schema, tabelas, views, funções, triggers, índices, etc.)
- ❌ **Limitações de paginação** (máximo 1000 registros por página)
- ❌ **Não exporta relacionamentos** automaticamente

## ✅ Backup Completo Recomendado

**Para backup COMPLETO (estrutura + dados), use:**

1. **Painel do Supabase (100% garantido):**
   - https://app.supabase.com/project/cghzttbggklhuyqxzabq
   - Database → Backups → Download

2. **pg_dump** (quando pooler funcionar):
   - Via pooler Session Mode (quando connection string estiver correta)
   - Ou conexão direta (quando IPv6 funcionar)

## 📊 Quando Usar API REST

Use a API REST APENAS se:
- ✅ Precisar exportar apenas dados de tabelas específicas
- ✅ Como último recurso antes de usar o painel
- ✅ Não precisa da estrutura do banco (schema)

## 🔐 Segurança

- ⚠️ **NUNCA** compartilhe a `service_role key` publicamente
- ⚠️ **NUNCA** commite a chave no código
- ✅ Use variáveis de ambiente
- ✅ Adicione `.env` ao `.gitignore`

---

**Referência:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
