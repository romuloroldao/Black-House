# 📋 Instruções para Importar Apenas a Estrutura

**Arquivo**: `schema_apenas_estrutura.sql`  
**Conteúdo**: Apenas estrutura (tabelas, funções, triggers, índices) - **SEM DADOS**

---

## 🎯 Objetivo

Importar apenas a estrutura do banco de dados, permitindo que você insira os dados manualmente depois.

---

## 📋 Pré-requisitos

1. PostgreSQL 15+ instalado e rodando
2. Banco de dados `blackhouse_db` criado
3. Usuário `app_user` criado com permissões

---

## 🚀 Passo a Passo

### 1. Verificar Banco Atual

```bash
# Verificar se o banco existe
sudo -u postgres psql -p 5432 -l | grep blackhouse_db

# Verificar tabelas existentes (se houver)
sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dt"
```

### 2. (Opcional) Limpar Banco Existente

⚠️ **CUIDADO**: Isso apaga TODOS os dados!

```bash
# Conectar ao banco
sudo -u postgres psql -p 5432 -d blackhouse_db

# Limpar schemas
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS app_auth CASCADE;

# Recriar schemas
CREATE SCHEMA public;
CREATE SCHEMA app_auth;

# Sair
\q
```

### 3. Importar Estrutura

```bash
# Importar schema
sudo -u postgres psql -p 5432 -d blackhouse_db -f /root/schema_apenas_estrutura.sql
```

Ou se estiver no diretório `/root`:
```bash
sudo -u postgres psql -p 5432 -d blackhouse_db -f schema_apenas_estrutura.sql
```

### 4. Verificar Estrutura Criada

```bash
# Listar todas as tabelas
sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dt"

# Contar tabelas
sudo -u postgres psql -p 5432 -d blackhouse_db -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('public', 'app_auth');"

# Verificar se não há dados
sudo -u postgres psql -p 5432 -d blackhouse_db -c "SELECT COUNT(*) FROM public.alunos;"
# Deve retornar: 0
```

### 5. Verificar Extensões

```bash
# Verificar extensões instaladas
sudo -u postgres psql -p 5432 -d blackhouse_db -c "\dx"

# Deve mostrar:
# - pgcrypto
# - uuid-ossp
```

---

## 📊 O Que Será Criado

### Schemas
- `app_auth` - Autenticação
- `public` - Tabelas principais

### Tabelas (43 total)
- 2 em `app_auth` (users, sessions)
- 41 em `public` (alunos, treinos, dietas, etc.)

### Funcionalidades
- Funções de autenticação
- Triggers automáticos
- Índices de performance
- Constraints e validações

---

## ✅ Validação Pós-Importação

### Checklist

- [ ] Todas as tabelas criadas (43 total)
- [ ] Extensões instaladas (pgcrypto, uuid-ossp)
- [ ] Funções criadas
- [ ] Triggers criados
- [ ] Índices criados
- [ ] Nenhum dado inserido (tabelas vazias)

### Comandos de Validação

```sql
-- Contar tabelas
SELECT 
    table_schema,
    COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema IN ('public', 'app_auth')
GROUP BY table_schema;

-- Verificar extensões
SELECT extname FROM pg_extension;

-- Verificar funções
SELECT 
    n.nspname as schema,
    p.proname as function
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'app_auth')
ORDER BY n.nspname, p.proname;

-- Verificar se tabelas estão vazias
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = t.schemaname AND table_name = t.tablename) as colunas
FROM pg_tables t
WHERE schemaname IN ('public', 'app_auth')
ORDER BY schemaname, tablename;
```

---

## 📝 Inserir Dados Manualmente

Após importar a estrutura, você pode inserir dados manualmente:

### Exemplo: Criar um Usuário (Coach)

```sql
-- 1. Criar usuário na tabela de autenticação
SELECT app_auth.create_user('coach@email.com', 'senha123');

-- 2. Verificar se foi criado
SELECT id, email FROM app_auth.users WHERE email = 'coach@email.com';

-- 3. O trigger já cria o user_role automaticamente
SELECT * FROM public.user_roles;
```

### Exemplo: Inserir um Aluno

```sql
-- Inserir aluno (substitua o coach_id pelo UUID real)
INSERT INTO public.alunos (
    nome,
    email,
    coach_id,
    data_nascimento,
    peso,
    objetivo
) VALUES (
    'João Silva',
    'joao@email.com',
    'uuid-do-coach-aqui',
    '1990-01-15',
    75000, -- peso em gramas
    'Ganho de massa muscular'
);
```

### Exemplo: Inserir um Treino

```sql
INSERT INTO public.treinos (
    nome,
    descricao,
    duracao,
    dificuldade,
    categoria,
    coach_id,
    exercicios
) VALUES (
    'Treino A - Peito e Tríceps',
    'Treino focado em peito e tríceps',
    60,
    'Intermediário',
    'Força',
    'uuid-do-coach-aqui',
    '[]'::jsonb
);
```

---

## ⚠️ Importante

### Ordem de Inserção

Algumas tabelas têm dependências. Insira na seguinte ordem:

1. **app_auth.users** (usuários/coaches)
2. **public.user_roles** (papéis - criado automaticamente pelo trigger)
3. **public.coach_profiles** (perfis de coaches)
4. **public.alunos** (alunos - precisa de coach_id)
5. **public.treinos** (treinos - precisa de coach_id)
6. **public.dietas** (dietas - precisa de aluno_id)
7. **public.alunos_treinos** (relação aluno-treino)
8. Demais tabelas conforme dependências

### Foreign Keys

Respeite as foreign keys ao inserir dados:
- `alunos.coach_id` → `app_auth.users.id`
- `treinos.coach_id` → `app_auth.users.id`
- `dietas.aluno_id` → `alunos.id`
- etc.

---

## 🔧 Troubleshooting

### Erro: "relation already exists"
```sql
-- Se a tabela já existe, você pode:
-- 1. Dropar e recriar (CUIDADO: apaga dados)
DROP TABLE IF EXISTS public.nome_tabela CASCADE;

-- 2. Ou usar CREATE TABLE IF NOT EXISTS (já está no script)
```

### Erro: "extension already exists"
```sql
-- Extensões já instaladas, pode ignorar
-- O script usa CREATE EXTENSION IF NOT EXISTS
```

### Erro: "permission denied"
```bash
# Verificar permissões do usuário
sudo -u postgres psql -p 5432 -d blackhouse_db -c "\du app_user"

# Dar permissões se necessário
sudo -u postgres psql -p 5432 -d blackhouse_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;"
```

---

## 📊 Resumo

- ✅ Arquivo: `schema_apenas_estrutura.sql`
- ✅ Tamanho: ~62 KB
- ✅ Linhas: ~2.255
- ✅ Conteúdo: Apenas estrutura (sem dados)
- ✅ Tabelas: 43 tabelas
- ✅ Funções: Múltiplas funções
- ✅ Triggers: Triggers automáticos
- ✅ Índices: Índices de performance

---

**Última atualização**: 12 de Janeiro de 2026  
**Arquivo**: `schema_apenas_estrutura.sql`  
**Status**: ✅ Pronto para uso
