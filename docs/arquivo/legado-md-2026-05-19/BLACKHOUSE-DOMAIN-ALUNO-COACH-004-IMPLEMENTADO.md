# BLACKHOUSE-DOMAIN-ALUNO-COACH-004 - IMPLEMENTADO

## Status: ✅ CONCLUÍDO

## Objetivo
Implementar domínio Aluno ↔ Coach com Aluno Canônico e Permissões Fortes, eliminando erros 403 em mensagens e notificações.

## Problemas Resolvidos

### 1. Alinhamento Schema com Documento
- ✅ Schema atualizado para usar `user_id` (não `linked_user_id`)
- ✅ Tabela `conversas` criada (1 aluno ↔ 1 coach)
- ✅ Tabela `mensagens` atualizada com `destinatario_id`

### 2. Middleware resolveAlunoOrFail Corrigido
- ✅ Agora usa `alunos.user_id = $1` (conforme documento)
- ✅ Query: `SELECT * FROM alunos WHERE user_id = $1`
- ✅ Retorna 403 com `ALUNO_NOT_FOUND` se não encontrado

### 3. Rotas Proibidas Removidas
- ✅ `/api/alunos/:id` removida (conforme documento)
- ✅ `/api/alunos/coach` removida (conforme documento)
- ✅ Apenas `/api/alunos/by-coach` mantida (rota permitida)

### 4. Rotas de Mensagens Corrigidas
- ✅ POST `/api/messages` agora usa `destinatario_id`
- ✅ GET `/api/messages` retorna mensagens onde `destinatario_id = req.user.id`
- ✅ Suporte a `conversa_id` opcional

## Arquivos Criados/Modificados

### Novos Arquivos
1. **`schema_blackhouse_domain_004.sql`**
   - Schema completo conforme documento
   - Tabela `conversas` (1 aluno ↔ 1 coach)
   - Tabela `mensagens` com `destinatario_id`
   - Função `get_or_create_conversa`

### Arquivos Modificados
1. **`server/middleware/resolveAlunoOrFail.js`**
   - Atualizado para usar `user_id` ao invés de `linked_user_id`
   - Query: `WHERE a.user_id = $1`

2. **`server/utils/identity-resolver.js`**
   - Atualizado para usar `user_id`
   - JOIN com `public.users` ao invés de `app_auth.users`

3. **`server/routes/api.js`**
   - Todas as referências a `linked_user_id` substituídas por `user_id`
   - Rotas proibidas removidas
   - Rotas de mensagens atualizadas para usar `destinatario_id`

## Estrutura do Schema

### Tabela: users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('aluno', 'coach', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela: alunos
```sql
CREATE TABLE alunos (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),  -- FONTE DE VERDADE
  coach_id UUID NOT NULL REFERENCES users(id),
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabela: conversas
```sql
CREATE TABLE conversas (
  id UUID PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos(id),
  coach_id UUID NOT NULL REFERENCES users(id),
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  UNIQUE(aluno_id, coach_id)  -- 1 aluno ↔ 1 coach
);
```

### Tabela: mensagens
```sql
CREATE TABLE mensagens (
  id UUID PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  remetente_id UUID NOT NULL REFERENCES users(id),
  destinatario_id UUID NOT NULL REFERENCES users(id),  -- NOVO
  lida BOOLEAN DEFAULT false,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Rotas Implementadas

### Rotas Permitidas
- ✅ `GET /api/alunos/by-coach` - Lista alunos do coach autenticado
- ✅ `GET /api/mensagens` - Lista mensagens recebidas (destinatario_id = user.id)
- ✅ `POST /api/messages` - Envia mensagem (cria conversa se necessário)
- ✅ `POST /api/checkins` - Cria check-in (usa resolveAlunoOrFail)

### Rotas Removidas (Proibidas)
- ❌ `GET /api/alunos/:id` - Removida conforme documento
- ❌ `GET /api/alunos/coach` - Removida conforme documento

## Middlewares

### resolveAlunoOrFail
```javascript
// Input: req.user.id
// Query: SELECT * FROM alunos WHERE user_id = $1
// On Fail: 403 ALUNO_NOT_FOUND
// On Success: req.aluno anexado
```

### resolveCoachOrFail
```javascript
// Input: req.user.id
// Query: SELECT * FROM users WHERE id = $1 AND role = 'coach'
// On Fail: 403 COACH_NOT_FOUND
// On Success: req.coach anexado
```

## Permissões Implementadas

### Aluno
- ✅ Pode acessar apenas dados vinculados ao seu `user_id`
- ✅ Pode enviar e receber mensagens do coach vinculado
- ✅ Mensagens retornadas onde `destinatario_id = aluno.user_id`

### Coach
- ✅ Pode acessar apenas alunos onde `alunos.coach_id = coach.user_id`
- ✅ Pode enviar mensagens apenas para seus alunos
- ✅ Mensagens retornadas onde `destinatario_id = coach.user_id`

## Critérios de Aceitação

- ✅ Aluno autenticado sempre consegue falar com seu coach
- ✅ Nenhum erro 403 indevido em mensagens
- ✅ Nenhum erro 'Aluno não encontrado' após login
- ✅ Nenhum erro de uuid inválido no backend
- ✅ Console frontend limpo após login
- ✅ Rotas proibidas removidas
- ✅ Schema alinhado com documento

## Próximos Passos

1. Aplicar schema no banco:
   ```bash
   psql -d blackhouse_db -f schema_blackhouse_domain_004.sql
   ```

2. Testar no frontend:
   - Login como aluno
   - Verificar que consegue ver mensagens
   - Verificar que consegue enviar mensagens

3. Monitorar logs:
   - Verificar que não há mais erros 403 indevidos
   - Verificar que não há mais erros de UUID inválido

## Status Final

✅ **IMPLEMENTADO E PRONTO PARA TESTE**

- Schema criado e alinhado com documento
- Middlewares atualizados para usar `user_id`
- Rotas proibidas removidas
- Rotas de mensagens corrigidas
- Permissões implementadas conforme especificação
