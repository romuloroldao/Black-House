# 📋 Respostas para o Assistente de Export do Supabase

## 🎯 Objetivo: Backup COMPLETO do Banco de Dados

Você quer **TUDO**: base de dados, usuários, credenciais, armazenamento de fotos, formulários, etc.

---

## ✅ Respostas ao Assistente do Supabase

### 1. Schema para Exportar

**Pergunta:** Você quer um export completo do schema "public" somente ou de todos os schemas do projeto?

**✅ RESPOSTA:**
```
Todos os schemas do projeto
```

**Por quê?**
- O Supabase usa múltiplos schemas além de `public`:
  - `public` - Suas tabelas e dados principais
  - `auth` - Usuários e autenticação
  - `storage` - Metadados de arquivos (fotos, etc)
  - Outros schemas customizados que você possa ter criado

---

### 2. Sequences (Sequências)

**Pergunta:** Deseja que as SEQUENCES sejam recriadas com o valor atual (last_value) ou apenas com o valor inicial definido (start_value)?

**✅ RESPOSTA:**
```
Usar last_value (preservar próximo valor atual)
```

**Por quê?**
- ✅ Mantém IDs numéricos contínuos
- ✅ Evita conflitos ao importar dados
- ✅ Preserva o estado atual das sequências
- ✅ Importante para evitar duplicação de IDs

---

### 3. RLS Policies, Funções e Dados

**Pergunta:** Quer também exportar RLS policies e funções (procedures/triggers) e dados (INSERTs) das tabelas?

**✅ RESPOSTA:**
```
DDL + dados (INSERTs para cada tabela)
```

**Por quê?**
- ✅ DDL (estrutura): Tabelas, views, funções, triggers, RLS policies
- ✅ Dados (INSERTs): Todos os registros de todas as tabelas
- ⚠️ Arquivo pode ficar grande, mas é necessário para backup completo

**Nota:** Se o arquivo ficar muito grande, você pode:
- Baixar em partes (por schema)
- Ou usar formato custom dump (mais compacto)

---

### 4. Formato de Saída

**Pergunta:** Preferência de formato de saída: um único arquivo SQL com todos os statements ou vários arquivos por objeto?

**✅ RESPOSTA:**
```
Um único arquivo SQL (.sql)
```

**Por quê?**
- ✅ Mais fácil de gerenciar
- ✅ Importação simples (um comando)
- ✅ Recomendado pelo próprio Supabase

---

## 📋 Resumo das Respostas

```
1. Schema: Todos os schemas do projeto
2. Sequences: Usar last_value (preservar próximo valor atual)
3. RLS/Funções/Dados: DDL + dados (INSERTs para cada tabela)
4. Formato: Um único arquivo SQL (.sql)
```

---

## ⚠️ IMPORTANTE: Storage (Fotos/Arquivos)

**O export SQL NÃO inclui arquivos do Storage!**

O assistente exporta apenas:
- ✅ Estrutura do banco (schemas, tabelas, etc)
- ✅ Dados do banco (INSERTs)
- ✅ RLS policies
- ✅ Funções e triggers
- ✅ Sequences

**MAS NÃO exporta:**
- ❌ **Arquivos do Storage** (fotos, documentos, etc)
- ❌ **Buckets e configurações de Storage**

### 🔧 Para Backup Completo do Storage:

**Opção 1: Download Manual pelo Painel**
1. Acesse: https://app.supabase.com/project/cghzttbggklhuyqxzabq
2. Vá em **Storage**
3. Para cada bucket (ex: `avatars`, `progress-photos`):
   - Abra o bucket
   - Baixe os arquivos manualmente ou
   - Use a opção de download em massa (se disponível)

**Opção 2: Usar Supabase CLI (se tiver acesso)**
```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Download de bucket
supabase storage download [bucket-name] --project-ref cghzttbggklhuyqxzabq
```

**Opção 3: Script de Backup do Storage via API**
- Use o script: `/root/backup-supabase/backup-via-api-rest.js`
- Modificado para fazer download dos arquivos do Storage

---

## ✅ Checklist de Backup Completo

Para ter **TUDO** do projeto, você precisa:

### 1. Banco de Dados (via Assistente) ✅
- [x] Exportar todos os schemas
- [x] Sequences com last_value
- [x] DDL + Dados (INSERTs)
- [x] RLS policies
- [x] Funções e triggers
- [x] Formato: SQL único

### 2. Storage/Arquivos (separado) ⚠️
- [ ] Bucket `avatars` - Download manual ou script
- [ ] Bucket `progress-photos` - Download manual ou script
- [ ] Outros buckets - Verificar no painel
- [ ] Configurações de Storage (políticas RLS do storage)

### 3. Configurações do Projeto (opcional)
- [ ] Variáveis de ambiente
- [ ] Edge Functions (se tiver)
- [ ] Webhooks configurados
- [ ] Configurações de Auth (providers, templates, etc)

---

## 📝 Comandos para Usar no Novo Servidor PostgreSQL

Depois de baixar o backup SQL, para importar no seu PostgreSQL:

```bash
# 1. Criar banco de dados
sudo -u postgres psql -p 5433 -c "CREATE DATABASE blackhouse_db OWNER app_user;"

# 2. Criar extensões necessárias
sudo -u postgres psql -p 5433 -d blackhouse_db -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
sudo -u postgres psql -p 5433 -d blackhouse_db -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 3. Importar backup SQL
psql -h localhost -p 5433 -U app_user -d blackhouse_db -f backup_completo.sql

# Ou se o arquivo for muito grande, usar:
psql -h localhost -p 5433 -U app_user -d blackhouse_db < backup_completo.sql
```

---

## 🎯 Resumo Final das Respostas

**Copie e cole estas respostas ao assistente:**

```
1. Todos os schemas do projeto
2. Usar last_value (preservar próximo valor atual)
3. DDL + dados (INSERTs para cada tabela)
4. Um único arquivo SQL (.sql)
```

**Depois disso:**
- ✅ O assistente vai gerar o backup SQL completo
- ✅ Você poderá baixar o arquivo
- ⚠️ Lembre-se de fazer backup dos arquivos do Storage separadamente!

---

**Data:** $(date)
**Status:** ✅ Pronto para export completo
