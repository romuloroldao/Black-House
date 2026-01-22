# 📤 Guia Completo de Exportação do Supabase

## 🎯 Objetivo

Exportar todos os dados e estrutura do banco de dados Supabase para migração para PostgreSQL puro.

## ⚠️ Informação Importante

Para exportação **completa** (schema + dados), você precisa da **SENHA DO POSTGRESQL**, não das chaves de API.

- ✅ **SUPABASE_PASSWORD** (senha do PostgreSQL) → Exportação completa via `pg_dump`
- ❌ **SUPABASE_ANON_KEY** → Apenas para API (não funciona com pg_dump)
- ❌ **SUPABASE_SERVICE_ROLE_KEY** → Apenas para API (não funciona com pg_dump)

## 📋 Credenciais Disponíveis

Você já tem:
- ✅ `PROJECT_REF`: `cghzttbggklhuyqxzabq`
- ✅ `SUPABASE_URL`: `https://cghzttbggklhuyqxzabq.supabase.co`
- ✅ `SUPABASE_ANON_KEY`: (fornecida)
- ⚠️ `SUPABASE_PASSWORD`: **Precisa obter** (ver abaixo)

## 🔑 Como Obter a Senha do PostgreSQL

**Siga o guia detalhado em:** `COMO_OBTER_SENHA_POSTGRESQL.md`

**Resumo rápido:**
1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `cghzttbggklhuyqxzabq`
3. Vá em: **Settings → Database**
4. Procure: **"Connection string"** ou **"Database password"**
5. Copie a senha (ou resete se necessário)

## 🚀 Método Recomendado: pg_dump

### Passo 1: Obter Senha

Siga `COMO_OBTER_SENHA_POSTGRESQL.md`

### Passo 2: Exportar

```bash
cd /root

# Definir senha
export SUPABASE_PASSWORD='sua_senha_postgresql_aqui'

# Executar exportação completa
./scripts/exportar-supabase-completo.sh
```

### O que será exportado:

- ✅ `backup/schema_public.sql` - Estrutura completa das tabelas públicas
- ✅ `backup/data.sql` - Todos os dados das tabelas públicas
- ✅ Schemas excluídos: auth, storage, supabase_functions, realtime, vault

## 📦 Métodos Alternativos

### Método 2: Supabase CLI

```bash
# Instalar e fazer login
npm install -g supabase
npx supabase login

# Exportar
npx supabase db dump --project-ref cghzttbggklhuyqxzabq > backup/schema.sql
```

### Método 3: Via Dashboard

1. Dashboard → Database → Backups
2. Criar backup manual
3. Baixar arquivo SQL

### Método 4: Via API (Limitado)

```bash
export SUPABASE_SERVICE_ROLE_KEY='sua_service_role_key'
./scripts/exportar-via-api.sh
```

⚠️ **Limitado**: Apenas dados, não schema completo.

## ✅ Após Exportar

1. **Adaptar schema:**
   ```bash
   ./scripts/adapt-schema.sh backup/schema_public.sql backup/schema_public_adapted.sql
   ```

2. **Importar no PostgreSQL local:**
   ```bash
   ./scripts/importar-dados.sh
   ```

## 🔍 Verificar Exportação

```bash
# Ver tamanho dos arquivos
ls -lh backup/*.sql

# Ver primeiras linhas do schema
head -20 backup/schema_public.sql

# Ver primeiras linhas dos dados
head -20 backup/data.sql
```

## ⚠️ Problemas Comuns

### Erro: "password authentication failed"
- Verifique se a senha está correta
- Tente resetar a senha no dashboard

### Erro: "connection refused"
- Verifique se o projeto está ativo
- Verifique firewall/proxy

### Arquivo vazio
- Verifique se há dados no banco
- Verifique se os schemas não foram todos excluídos

## 📞 Suporte

Se tiver problemas:
1. Verifique: `COMO_OBTER_SENHA_POSTGRESQL.md`
2. Teste conexão: `psql "postgresql://postgres:SENHA@db.cghzttbggklhuyqxzabq.supabase.co:5432/postgres" -c "SELECT 1;"`
3. Verifique logs do script

## ✅ Checklist

- [ ] Senha do PostgreSQL obtida
- [ ] Exportação executada
- [ ] Arquivos em `backup/` verificados
- [ ] Schema adaptado
- [ ] Dados importados no PostgreSQL local

---

**Lembre-se**: A senha do PostgreSQL é diferente das chaves de API. Você precisa dela para exportação completa!
