# 📋 Schema Apenas Estrutura - Sem Dados

**Data**: 12 de Janeiro de 2026  
**Arquivo**: `schema_apenas_estrutura.sql`

---

## 📄 Descrição

Este arquivo contém **APENAS a estrutura** do banco de dados:
- ✅ Tabelas (CREATE TABLE)
- ✅ Tipos (CREATE TYPE)
- ✅ Funções (CREATE FUNCTION)
- ✅ Triggers (CREATE TRIGGER)
- ✅ Índices (CREATE INDEX)
- ✅ Constraints (PRIMARY KEY, FOREIGN KEY, CHECK)
- ❌ **SEM dados** (sem INSERT, sem COPY)

---

## 🎯 Uso

### Importar Apenas a Estrutura

```bash
# Conectar ao banco
psql -U app_user -d blackhouse_db -f schema_apenas_estrutura.sql
```

Ou via sudo:
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db -f schema_apenas_estrutura.sql
```

### Depois, Inserir Dados Manualmente

Após importar a estrutura, você pode inserir dados manualmente:

```sql
-- Exemplo: Inserir um aluno
INSERT INTO public.alunos (nome, email, coach_id)
VALUES ('João Silva', 'joao@email.com', 'uuid-do-coach');

-- Exemplo: Inserir um treino
INSERT INTO public.treinos (nome, descricao, coach_id)
VALUES ('Treino A', 'Treino de peito e tríceps', 'uuid-do-coach');
```

---

## 📊 O Que Está Incluído

### Schemas
- `app_auth` - Autenticação (users, sessions)
- `public` - Tabelas principais da aplicação

### Tabelas (43 total)
- 2 tabelas em `app_auth`
- 41 tabelas em `public`

### Extensões
- `uuid-ossp` - Geração de UUIDs
- `pgcrypto` - Criptografia

### Funcionalidades
- Triggers automáticos para `updated_at`
- Índices de performance
- Constraints de validação
- Foreign keys

---

## ⚠️ Importante

### Antes de Importar

1. **Verificar se o banco está vazio** (ou fazer backup):
   ```bash
   sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dt"
   ```

2. **Criar extensões se necessário**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   ```

### Após Importar

1. **Verificar estrutura criada**:
   ```bash
   sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dt"
   sudo -u postgres psql -p 5432 -d blackhouse_db -c "\d app_auth.users"
   ```

2. **Inserir dados manualmente** conforme necessário

---

## 🔄 Fluxo Recomendado

### 1. Limpar Banco (Se Necessário)
```bash
# ⚠️ CUIDADO: Isso apaga tudo!
sudo -u postgres psql -p 5432 -d blackhouse_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### 2. Importar Estrutura
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db -f schema_apenas_estrutura.sql
```

### 3. Verificar
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dt"
```

### 4. Inserir Dados
```sql
-- Inserir dados manualmente conforme necessário
INSERT INTO public.alunos ...
INSERT INTO public.treinos ...
-- etc.
```

---

## 📝 Notas

- O arquivo foi gerado com `pg_dump --schema-only`
- Não contém dados (INSERT, COPY)
- Não contém owner/privileges (--no-owner --no-privileges)
- Pode ser executado múltiplas vezes (usa IF NOT EXISTS onde possível)

---

## 🧪 Validação

### Verificar Estrutura Após Importar

```sql
-- Contar tabelas
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema IN ('public', 'app_auth');

-- Listar todas as tabelas
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('public', 'app_auth')
ORDER BY table_schema, table_name;

-- Verificar se não há dados
SELECT COUNT(*) FROM public.alunos; -- Deve retornar 0
```

---

**Última atualização**: 12 de Janeiro de 2026  
**Arquivo**: `schema_apenas_estrutura.sql`  
**Tamanho**: ~62 KB  
**Linhas**: ~2.255 linhas  
**Conteúdo**: Apenas estrutura (sem dados)

## ✅ Validação

- ✅ Sem INSERT statements
- ✅ Sem COPY statements  
- ✅ Apenas CREATE statements
- ✅ Inclui: tabelas, tipos, funções, triggers, índices, constraints
