# DESIGN-GUARD-RAILS-ROLE-ACCESS-003 - IMPLEMENTADO

**Version:** 1.0.0  
**Status:** ✅ IMPLEMENTED  
**Scope:** Guard rails para impedir acessos indevidos a rotas por role, mesmo com frontend incorreto

## Objetivo

Impedir definitivamente acessos indevidos a rotas por role, garantindo que o backend seja a fonte única de verdade e que o frontend não seja confiável.

## Princípios

- ✅ **Backend é fonte única de verdade**
- ✅ **Frontend não é confiável**

## Implementações

### 1. Middleware `validateRole`

Criado middleware dedicado para validar role explicitamente antes de qualquer processamento.

**Arquivo:** `/root/server/middleware/validateRole.js`

**Funcionalidade:**
- Valida que `req.user.role` está em `allowedRoles`
- Retorna `403 ROLE_FORBIDDEN` se role não permitido
- Loga tentativas de acesso indevido
- Frontend incorreto não quebra backend

**Uso:**
```javascript
router.get('/api/mensagens', authenticate, validateRole(['aluno']), resolveAlunoOrFail, handler);
```

### 2. Middlewares `resolveAlunoOrFail` e `resolveCoachOrFail` Aprimorados

Ambos os middlewares agora validam role explicitamente antes de processar.

**Arquivo:** `/root/server/middleware/resolveAlunoOrFail.js`
- Valida que role é `'aluno'`, `'coach'` ou `'admin'` antes de processar
- Retorna `403 ROLE_FORBIDDEN` se role inválido

**Arquivo:** `/root/server/middleware/resolveCoachOrFail.js`
- Valida que role é `'coach'` ou `'admin'` antes de processar
- Retorna `403 ROLE_FORBIDDEN` se role inválido

### 3. Rotas Protegidas

#### Rotas `alunoOnly` (Apenas Alunos)

Todas as rotas de alunos agora têm `validateRole(['aluno'])`:

- ✅ `GET /api/alunos/me` - `validateRole(['aluno'])` + `resolveAlunoOrFail`
- ✅ `PATCH /api/alunos/me` - `validateRole(['aluno'])` + `resolveAlunoOrFail`
- ✅ `GET /api/mensagens` - `validateRole(['aluno'])` + `resolveAlunoOrFail`
- ✅ `POST /api/mensagens` - `validateRole(['aluno'])` + `resolveAlunoOrFail`
- ✅ `GET /api/notificacoes` - `validateRole(['aluno'])` + `resolveAlunoOrFail`
- ✅ `POST /api/checkins` - `validateRole(['aluno'])` + `resolveAlunoOrFail`

#### Rotas `coachOnly` (Apenas Coaches)

Todas as rotas de coaches agora têm `validateRole(['coach'])`:

- ✅ `POST /api/alunos/link-user` - `validateRole(['coach'])` + `resolveCoachOrFail`
- ✅ `GET /api/alunos/by-coach` - `validateRole(['coach'])` + `resolveCoachOrFail`

#### Rotas `shared` (Compartilhadas)

Rotas compartilhadas não têm validação de role (são públicas após autenticação):

- ✅ `POST /api/auth/login` - Sem validação de role (público)
- ✅ `GET /api/auth/me` - Sem validação de role (qualquer autenticado)

## Estrutura de Proteção

### Camadas de Validação

1. **Autenticação** (`authenticate`)
   - Valida token JWT
   - Injeta `req.user` com `id` e `role`

2. **Validação de Role** (`validateRole(['aluno'])` ou `validateRole(['coach'])`)
   - Valida que role está permitido
   - Retorna `403 ROLE_FORBIDDEN` se não permitido
   - **NOVO:** Primeira linha de defesa

3. **Resolução de Domínio** (`resolveAlunoOrFail` ou `resolveCoachOrFail`)
   - Resolve entidade canônica (aluno ou coach)
   - Valida que entidade existe e pertence ao usuário
   - Retorna `403` se não encontrado

4. **Handler da Rota**
   - Processa requisição com entidade já resolvida

### Exemplo de Fluxo

**Rota:** `GET /api/mensagens`

1. `authenticate` → Valida JWT, injeta `req.user = { id: '...', role: 'coach' }`
2. `validateRole(['aluno'])` → **BLOQUEIA** (role='coach' não está em ['aluno'])
   - Retorna `403 ROLE_FORBIDDEN`
   - **Nunca chega ao handler**

**Rota:** `GET /api/mensagens` (com role='aluno')

1. `authenticate` → Valida JWT, injeta `req.user = { id: '...', role: 'aluno' }`
2. `validateRole(['aluno'])` → **PERMITE** (role='aluno' está em ['aluno'])
3. `resolveAlunoOrFail` → Resolve aluno via `user_id`, injeta `req.aluno`
4. Handler → Processa requisição com `req.aluno` já resolvido

## Comportamento de Falha

### Acesso com Role Incorreto

**Request:**
```http
GET /api/mensagens
Authorization: Bearer <token_de_coach>
```

**Response:**
```json
{
  "error": "Acesso negado",
  "error_code": "ROLE_FORBIDDEN",
  "message": "Esta rota é apenas para: aluno. Seu role: coach",
  "allowed_roles": ["aluno"],
  "your_role": "coach"
}
```

**Status:** `403 Forbidden`

### Logging

Todas as tentativas de acesso indevido são logadas:

```javascript
logger.warn('DESIGN-GUARD-RAILS-ROLE-ACCESS-003: Role não permitido', {
    user_id: req.user?.id,
    user_role: userRole,
    allowed_roles: allowedRoles,
    path: req.path,
    method: req.method
});
```

## Critérios de Aceitação

- ✅ Coach nunca acessa rota de aluno
- ✅ Aluno nunca acessa rota de coach
- ✅ Erros são explícitos e sem efeitos colaterais
- ✅ Frontend incorreto não quebra backend
- ✅ Logs de tentativas de acesso indevido

## Testes Manuais

### Teste 1: Coach tentando acessar rota de aluno

```bash
# Login como coach
curl -X POST https://api.blackhouse.app.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "coach@example.com", "password": "..."}'

# Tentar acessar mensagens (deve falhar)
curl -X GET https://api.blackhouse.app.br/api/mensagens \
  -H "Authorization: Bearer <token_coach>"

# Esperado: 403 ROLE_FORBIDDEN
```

### Teste 2: Aluno tentando acessar rota de coach

```bash
# Login como aluno
curl -X POST https://api.blackhouse.app.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aluno@example.com", "password": "..."}'

# Tentar acessar alunos do coach (deve falhar)
curl -X GET https://api.blackhouse.app.br/api/alunos/by-coach \
  -H "Authorization: Bearer <token_aluno>"

# Esperado: 403 ROLE_FORBIDDEN
```

### Teste 3: Aluno acessando rota de aluno (deve funcionar)

```bash
# Login como aluno
curl -X POST https://api.blackhouse.app.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "aluno@example.com", "password": "..."}'

# Acessar mensagens (deve funcionar)
curl -X GET https://api.blackhouse.app.br/api/mensagens \
  -H "Authorization: Bearer <token_aluno>"

# Esperado: 200 OK com lista de mensagens
```

## Status Final

✅ **IMPLEMENTADO E TESTADO**

### Rotas Protegidas

- ✅ **6 rotas alunoOnly** protegidas com `validateRole(['aluno'])`
- ✅ **2 rotas coachOnly** protegidas com `validateRole(['coach'])`
- ✅ **2 rotas shared** sem validação de role (públicas após autenticação)

### Middlewares

- ✅ `validateRole` criado e funcionando
- ✅ `resolveAlunoOrFail` aprimorado com validação de role
- ✅ `resolveCoachOrFail` aprimorado com validação de role

### Segurança

- ✅ Backend é fonte única de verdade
- ✅ Frontend incorreto não quebra backend
- ✅ Erros explícitos e sem efeitos colaterais
- ✅ Logs de tentativas de acesso indevido

## Próximos Passos (Opcional)

1. Adicionar testes automatizados para validação de role
2. Adicionar rate limiting por role
3. Adicionar auditoria de acessos por role
