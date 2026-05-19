# DESIGN-ALUNOS-LINKED-USER-RESOLUTION-001

## Status

**BLOCKED_BY_MIGRATION** - Estado conhecido, controlado e reversível

**Severidade**: `CRITICAL_SCHEMA_MISSING` (mas não é bug - é estado esperado)

## Resumo

O vínculo aluno ↔ usuário está temporariamente indisponível porque a coluna `linked_user_id` não existe no banco de dados conectado pelo backend. Este é um **estado conhecido e controlado** que será revertido ao aplicar a migração SQL no banco correto.

## Causa Raiz

**Tipo**: `DATABASE_SCHEMA_MISMATCH`

**Descrição**: A migração `linked_user_id` foi aplicada em um banco diferente daquele apontado pela `DATABASE_URL` do backend.

**Erro PostgreSQL**: `POSTGRES_42703` (column does not exist)

**Tabela Afetada**: `public.alunos`

**Coluna Ausente**: `linked_user_id`

## Estado Atual

### ✅ NÃO É UM BUG

- **Estado Conhecido**: Sim - o sistema detecta e reporta corretamente
- **Integridade de Dados**: Segura - nenhum dado é corrompido
- **Modo Backend**: DEGRADED (proteção ativa)
- **Indisponibilidade Global**: NÃO - apenas domínio `alunos` afetado

### Funcionalidades Bloqueadas

- `alunos_user_linking` - Vínculo de aluno a usuário

### Funcionalidades Funcionando Normalmente

- ✅ `profiles` - Perfis de usuário
- ✅ `payment_plans` - Planos de pagamento
- ✅ `notificacoes` - Sistema de notificações
- ✅ `auth` - Autenticação e autorização
- ✅ `dashboard` - Painel administrativo
- ✅ `students_list` - Listagem de alunos (read-only)

## Próximo Passo (Não Negociável)

### Aplicar Migração SQL no Banco Correto

**Arquivo de Migração**:
```
/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

**Requisitos**:
- Aplicar no **MESMO banco** conectado pelo backend
- Usuário com privilégios de `OWNER` ou `SUPERUSER`
- Não aplicar em bancos Supabase errados

### Queries de Validação

Antes de aplicar a migração, validar banco conectado:

```sql
-- 1. Identificar banco conectado pelo backend
SELECT 
    current_database(), 
    current_schema(), 
    inet_server_addr(), 
    inet_server_port(), 
    current_user;

-- 2. Verificar se coluna já existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'alunos'
  AND column_name = 'linked_user_id';
-- RESULTADO ESPERADO: 0 rows (antes da migração)
-- RESULTADO ESPERADO: 1 row (após a migração)
```

### Métodos de Aplicação

#### Via Supabase Dashboard (Recomendado)

1. Acessar Supabase Dashboard
2. Navegar para **SQL Editor**
3. Copiar conteúdo de `/root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql`
4. Executar como **superuser/owner**
5. Validar que a query foi executada com sucesso

#### Via psql (Linha de Comando)

```bash
# Executar migração diretamente
psql -h localhost -p 5432 -U postgres -d blackhouse_db \
  -f /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql

# Ou conectar e executar
psql -h localhost -p 5432 -U postgres -d blackhouse_db
\i /root/supabase/migrations/20260116143000_add_linked_user_id_to_alunos.sql
```

### Notas Importantes

- ❌ **NÃO** reiniciar backend antes da migração (não é necessário)
- ❌ **NÃO** aplicar migração em bancos Supabase errados
- ✅ **DATABASE_URL** do backend é a única fonte válida de verdade
- ✅ Após aplicar, backend detectará automaticamente (cache de 60s)

## Contrato de Schema

### Tabela: `public.alunos`

### Coluna: `linked_user_id`

```sql
-- Especificação da coluna
column_name: linked_user_id
data_type: UUID
nullable: true
is_unique: false
source_of_truth: true -- Única fonte de verdade para vínculo

-- Foreign Key
references: app_auth.users(id)
on_delete: SET NULL -- Preserva registro do aluno
on_update: CASCADE -- Atualiza automaticamente

-- Comentário
COMMENT: 'ID do usuário vinculado (app_auth.users.id). NULL indica que o aluno não está vinculado a nenhuma credencial. Este campo é a única fonte de verdade para determinar vínculo.'
```

## Guards do Backend

### Validação no Boot

- **Status**: Habilitada
- **Modo Fail-Fast**: Desabilitado (permite modo DEGRADED)
- **Domínio**: `alunos`
- **Código de Erro**: `SCHEMA_LINKED_USER_ID_MISSING`

### Isolamento por Domínio

- **Estratégia**: `DOMAIN_RESOLVER` (DOMAIN-SCHEMA-ISOLATION-005)
- **Domínios Bloqueados Quando Inválido**: `["alunos"]` → 409 Conflict
- **Domínios Permitidos Quando Inválido**: 
  - `profiles` → 200 OK (com warning)
  - `payment_plans` → 200 OK (com warning)
  - `notificacoes` → 200 OK (com warning)
  - `auth` → 200 OK

### Política de Update (Whitelist)

**Tabela**: `alunos`

**Campos Permitidos**:
- `nome`
- `email`
- `telefone`
- `data_nascimento`
- `linked_user_id` ← Campo crítico para vínculo
- `peso`
- `altura`
- `idade`
- `objetivo`
- `plano`
- `cpf_cnpj`
- `status`

**Campos Proibidos**:
- `id` (imutável)
- `coach_id` (imutável via PATCH)
- `created_at` (gerenciado pelo banco)
- `updated_at` (gerenciado por trigger)

## Contrato do Frontend

### Tratamento de Erro

**Código de Erro**: `ALUNOS_SCHEMA_INVALID`

**Comportamento Esperado**:
- ✅ Desabilitar feature de vínculo de usuário
- ✅ Exibir aviso de manutenção contextual
- ❌ **NÃO** bloquear navegação global
- ✅ Continuar funcionando para outras funcionalidades

**HTTP Status**: 409 Conflict (não 503)

## Critérios de Conclusão

### ✅ Após Aplicar Migração

1. `SELECT linked_user_id` retorna coluna no banco conectado
2. Backend sai de `DEGRADED` para `OK` (cache invalida após 60s)
3. `PATCH /rest/v1/alunos` aceita `linked_user_id` sem erro
4. Vínculo aluno ↔ usuário funciona sem erro `400` ou `42703`
5. Nenhuma rota fora do domínio `alunos` retorna `503`

### Validação Pós-Migração

```bash
# 1. Verificar health check
curl https://api.blackhouse.app.br/health | jq '.'
# Deve retornar: { "status": "ok", "schema": { "valid": true } }

# 2. Testar PATCH em alunos
curl -X PATCH https://api.blackhouse.app.br/rest/v1/alunos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "...", "linked_user_id": "..."}'
# Deve retornar: 200 OK (não 409 ou 503)

# 3. Verificar que outros domínios funcionam
curl https://api.blackhouse.app.br/rest/v1/profiles
# Deve retornar: 200 OK (continua funcionando)
```

## Anti-Patterns Prevenidos

### ✅ Não Aplicar Migração em Banco Errado

- Backend loga identidade do banco no boot
- Mensagens de erro incluem instruções claras
- Validação manual disponível via queries

### ✅ Não Permitir PATCH sem Whitelist

- Backend valida campos permitidos explicitamente
- Campos proibidos são rejeitados com erro 400
- Política de segurança explícita

### ✅ Não Assumir Schema sem Validação

- Schema validado no boot e runtime
- Cache de validação evita queries repetidas
- Logs estruturados para observabilidade

### ✅ Não Bloquear API Inteira por Schema Parcial

- Isolamento por domínio (DOMAIN-SCHEMA-ISOLATION-005)
- Apenas domínio afetado é bloqueado (409 Conflict)
- Outros domínios continuam funcionando (200 OK)

### ✅ Não Fazer Hotfix em Produção para Erro Estrutural

- Problema estrutural requer migração SQL
- Sistema detecta e reporta corretamente
- Estado conhecido e controlado

## Nota Final

**Nenhuma alteração adicional de código é necessária.**

A correção é exclusivamente aplicar a migração SQL no banco correto. Todo o resto do sistema já está corretamente arquitetado para esse estado:

- ✅ Domain isolation funciona corretamente
- ✅ Schema validation detecta problema corretamente
- ✅ Guards de segurança estão ativos
- ✅ Frontend pode tratar erro contextualmente
- ✅ Observabilidade está completa

O sistema está **funcionando como projetado** para detectar e isolar esse tipo de problema estrutural.

## Documentação Relacionada

- **Design Completo**: `/root/DESIGN-LINKED-USER-ID.md`
- **Guia de Aplicação**: `/root/APLICAR-MIGRACAO-LINKED-USER-ID.md`
- **Documentação Urgente**: `/root/SCHEMA-LINKED-USER-ID-URGENT.md`
- **Domain Isolation**: `DOMAIN-SCHEMA-ISOLATION-005`
- **Schema Validator**: `/root/server/utils/schema-validator.js`
- **Domain Resolver**: `/root/server/utils/domain-resolver.js`
- **Domain Guard**: `/root/server/utils/domain-schema-guard.js`
- **DB Identity**: `/root/server/utils/db-identity.js`
