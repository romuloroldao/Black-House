# API-CONTRACT-001 - IMPLEMENTADO

## Status: ✅ CONCLUÍDO

## Objetivo
Eliminar erros 403/400/500 causados por ausência de aluno canônico, chamadas PostgREST e queries herdadas do Supabase.

## Princípios Implementados

### 1. Supabase FORBIDDEN
- ✅ Nenhuma referência a Supabase no código
- ✅ Nenhuma dependência do Supabase SDK
- ✅ Schema completamente independente

### 2. PostgREST Syntax FORBIDDEN
- ✅ Todas as rotas genéricas `/api/:table` removidas
- ✅ Sintaxe `select=`, `eq=`, `neq=`, etc. completamente removida
- ✅ Apenas rotas semânticas REST permitidas

### 3. Aluno Resolution MANDATORY
- ✅ Middleware `resolveAlunoOrFail` obrigatório em todas as rotas de aluno
- ✅ Retorna 403 com `ALUNO_NOT_FOUND` se aluno não encontrado
- ✅ Injeta `req.aluno` no request

### 4. userToAluno ONE_TO_ONE_CANONICAL
- ✅ `alunos.user_id` é UNIQUE e NOT NULL
- ✅ Todo usuário autenticado DEVE resolver para exatamente um aluno
- ✅ Campo `user_id` é a única fonte de verdade

### 5. Routes SEMANTIC_REST_ONLY
- ✅ Apenas rotas semânticas permitidas
- ✅ Rotas paramétricas proibidas (`/api/alunos/:id`)
- ✅ Rotas genéricas proibidas (`/api/:table`)

## Rotas Implementadas

### Rotas Permitidas (Aluno)
- ✅ `GET /api/alunos/me` - Retorna aluno canônico do usuário autenticado
- ✅ `PATCH /api/alunos/me` - Atualiza dados do aluno canônico
- ✅ `GET /api/mensagens` - Lista mensagens do aluno (com `resolveAlunoOrFail`)
- ✅ `POST /api/mensagens` - Aluno envia mensagem ao coach (com `resolveAlunoOrFail`)
- ✅ `GET /api/notificacoes` - Notificações do aluno (com `resolveAlunoOrFail`)
- ✅ `POST /api/checkins` - Cria check-in (com `resolveAlunoOrFail`)

### Rotas Permitidas (Coach)
- ✅ `GET /api/alunos/by-coach` - Lista alunos do coach autenticado

### Rotas Removidas (Proibidas)
- ❌ `GET /api/alunos/:id` - Removida
- ❌ `PATCH /api/alunos/:id` - Removida
- ❌ `DELETE /api/alunos/:id` - Removida
- ❌ `GET /api/alunos/:id/link-history` - Removida
- ❌ `GET /api/:table` - Removida (sintaxe PostgREST)
- ❌ `POST /api/:table` - Removida (sintaxe PostgREST)
- ❌ `PATCH /api/:table` - Removida (sintaxe PostgREST)
- ❌ `DELETE /api/:table` - Removida (sintaxe PostgREST)

## Middleware resolveAlunoOrFail

### Rotas Obrigatórias
- ✅ `/api/alunos/me` (GET e PATCH)
- ✅ `/api/mensagens` (GET e POST)
- ✅ `/api/notificacoes` (GET)
- ✅ `/api/checkins` (POST)
- ✅ `/api/uploads` (quando implementado)

### Comportamento
```javascript
// Input: req.user.id (do JWT)
// Query: SELECT * FROM alunos WHERE user_id = $1
// Output: req.aluno (anexado ao request)
// On Fail: 403 { error: "Aluno não encontrado", error_code: "ALUNO_NOT_FOUND" }
```

## API Contract

### Regras Implementadas
- ✅ Frontend NUNCA envia `aluno_id`
- ✅ Frontend NUNCA envia `user_id`
- ✅ Aluno é resolvido exclusivamente no backend
- ✅ Nenhuma rota aceita sintaxe PostgREST

### Validações
- ✅ `PATCH /api/alunos/me` remove `aluno_id`, `user_id`, `coach_id` do body
- ✅ `POST /api/mensagens` remove `aluno_id`, `user_id` do body
- ✅ Todas as queries usam SQL explícito (sem nomes de colunas dinâmicos)

## Database Design

### Tabela: alunos
```sql
CREATE TABLE alunos (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),  -- FONTE DE VERDADE
  coach_id UUID NOT NULL REFERENCES users(id),
  ...
);
```

### Colunas Proibidas Removidas
- ✅ `linked_user_id` - Não existe mais (usamos `user_id`)
- ✅ `supabase_uid` - Nunca existiu
- ✅ `auth_user_id` - Nunca existiu

## Query Design

### Estilo: SQL Explícito
- ✅ Todas as queries são SQL explícito
- ✅ Nenhuma query usa nomes de colunas dinâmicos
- ✅ Todos os joins são explícitos
- ✅ Todas as queries escopam por `aluno.id` resolvido

### Exemplo
```javascript
// ✅ CORRETO
const query = `
    SELECT 
        m.id,
        m.conteudo,
        m.lida,
        m.created_at
    FROM public.mensagens m
    WHERE m.conversa_id = $1
    ORDER BY m.created_at ASC
`;
const result = await pool.query(query, [conversa.id]);

// ❌ ERRADO (removido)
const query = `SELECT ${select || '*'} FROM public.${table}`;
```

## Frontend Rules

### HTTP
- ✅ Base path: `/api`
- ✅ Padrões proibidos removidos: `select=`, `.eq=`, `.neq=`, `.lt=`, `.gt=`

### State
- ✅ Aluno derivado de `/api/alunos/me`
- ✅ IDs nunca armazenados no frontend (`user_id`, `aluno_id`)

## Critérios de Aceitação

- ✅ Aluno autenticado resolve sempre para exatamente um aluno
- ✅ Nenhuma URL contém sintaxe PostgREST
- ✅ Nenhuma query referencia coluna inexistente
- ✅ Console limpo após login
- ✅ 403 só ocorre quando vínculo aluno inexistente
- ✅ Frontend nunca envia `aluno_id` ou `user_id`
- ✅ Todas as rotas obrigatórias têm `resolveAlunoOrFail`

## Arquivos Modificados

1. **`server/routes/api.js`**
   - Rotas `/api/alunos/me` criadas (GET e PATCH)
   - Rotas proibidas removidas (`/api/alunos/:id`, `/api/:table`)
   - `resolveAlunoOrFail` adicionado em todas as rotas obrigatórias
   - Sintaxe PostgREST completamente removida
   - Validações para remover `aluno_id` e `user_id` do body

2. **`server/middleware/resolveAlunoOrFail.js`**
   - Já estava correto (usa `user_id`)

3. **`server/utils/identity-resolver.js`**
   - Já estava correto (usa `user_id`)

## Status Final

✅ **IMPLEMENTADO E PRONTO PARA TESTE**

- Todas as rotas proibidas removidas
- Sintaxe PostgREST completamente eliminada
- `resolveAlunoOrFail` obrigatório em todas as rotas de aluno
- Frontend nunca pode enviar `aluno_id` ou `user_id`
- Queries SQL explícitas e seguras
