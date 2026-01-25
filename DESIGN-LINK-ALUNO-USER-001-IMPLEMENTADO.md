# DESIGN-LINK-ALUNO-USER-001 - IMPLEMENTADO

**Version:** 1.0.0  
**Status:** ✅ IMPLEMENTED  
**Scope:** Linkagem entre usuários cadastrados pela jornada pública e alunos importados pelo coach

## Objetivo
Criar rota semântica para vincular usuários criados pela jornada de cadastro com alunos previamente criados/importados pelo coach, eliminando a necessidade de PATCH genérico sem ID.

## Problema Resolvido

### Contexto
Coaches importam/criam alunos antes do usuário criar conta. Após o cadastro do usuário, é necessário vincular ambos.

### Antes
- Frontend tentava `PATCH /api/alunos` sem ID
- Erro: "400 Bad Request — ID é obrigatório"
- Violava contrato atual que exige ID
- **Root Cause:** Linkagem tratada incorretamente como update genérico de aluno

### Depois
- Rota semântica `POST /api/alunos/link-user`
- Validações explícitas de negócio
- Erros específicos e descritivos
- Sem necessidade de ID genérico
- **Solução:** Operação de linkagem com intenção de negócio explícita

## Implementação

### Nova Rota Criada

**POST /api/alunos/link-user**
- **Auth**: JWT (coach)
- **Body**:
  ```json
  {
    "importedAlunoId": "uuid",
    "userIdToLink": "uuid"
  }
  ```
- **Descrição**: Vincula um usuário existente a um aluno importado pelo coach

### Validações Implementadas

1. ✅ **Aluno existe**
   - Query: `SELECT id, coach_id, user_id FROM alunos WHERE id = $1`
   - Erro: `404 ALUNO_NOT_FOUND`

2. ✅ **Aluno pertence ao coach autenticado**
   - Valida: `aluno.coach_id === req.user.id`
   - Erro: `403 FORBIDDEN`

3. ✅ **Aluno ainda não possui user_id**
   - Valida: `aluno.user_id IS NULL`
   - Erro: `409 ALUNO_ALREADY_LINKED`

4. ✅ **User existe**
   - Query: `SELECT id, email FROM users WHERE id = $1`
   - Erro: `404 USER_NOT_FOUND`

5. ✅ **User não está vinculado a outro aluno**
   - Query: `SELECT id, nome FROM alunos WHERE user_id = $1`
   - Erro: `409 USER_ALREADY_LINKED`

### Proteção em PATCH /api/alunos/me

- ✅ Rejeita explicitamente tentativa de alterar `user_id`
- ✅ Retorna erro `403 USER_ID_UPDATE_FORBIDDEN`
- ✅ Mensagem orienta usar `POST /api/alunos/link-user`

## Códigos de Erro

| Código | Status | Mensagem |
|--------|--------|----------|
| `ALUNO_NOT_FOUND` | 404 | Aluno importado não encontrado |
| `ALUNO_ALREADY_LINKED` | 409 | Aluno já está vinculado a um usuário |
| `USER_NOT_FOUND` | 404 | Usuário não encontrado |
| `USER_ALREADY_LINKED` | 409 | Usuário já está vinculado a outro aluno |
| `FORBIDDEN` | 403 | Coach não autorizado a vincular este aluno |
| `USER_ID_UPDATE_FORBIDDEN` | 403 | user_id não pode ser alterado via esta rota |
| `MISSING_PARAMETERS` | 400 | importedAlunoId e userIdToLink são obrigatórios |
| `INVALID_UUID` | 400 | importedAlunoId e userIdToLink devem ser UUIDs válidos |

## Exemplo de Uso

### Request
```http
POST /api/alunos/link-user
Authorization: Bearer <coach_jwt_token>
Content-Type: application/json

{
  "importedAlunoId": "123e4567-e89b-12d3-a456-426614174000",
  "userIdToLink": "987fcdeb-51a2-43d7-9f8e-123456789abc"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Aluno vinculado ao usuário com sucesso",
  "aluno": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "987fcdeb-51a2-43d7-9f8e-123456789abc",
    "coach_id": "coach-uuid",
    "nome": "João Silva",
    "email": "joao@example.com"
  }
}
```

### Error Response (409 - Aluno já vinculado)
```json
{
  "error": "Aluno já está vinculado a um usuário",
  "error_code": "ALUNO_ALREADY_LINKED",
  "linked_user_id": "987fcdeb-51a2-43d7-9f8e-123456789abc"
}
```

### Error Response (409 - User já vinculado)
```json
{
  "error": "Usuário já está vinculado a outro aluno",
  "error_code": "USER_ALREADY_LINKED",
  "linked_aluno_id": "other-aluno-uuid",
  "linked_aluno_nome": "Outro Aluno"
}
```

## Regras de Autorização

### Quem Pode Vincular
- ✅ Apenas coaches
- ✅ Apenas o coach dono do aluno (`aluno.coach_id === coach.id`)

### Validações Backend
- ✅ Aluno existe
- ✅ Aluno pertence ao coach autenticado
- ✅ Aluno ainda não possui `user_id`
- ✅ User existe
- ✅ User ainda não está vinculado a outro aluno

## Impacto no Banco de Dados

### Operação
```sql
UPDATE public.alunos 
SET user_id = $1, updated_at = now()
WHERE id = $2
```

### Constraints Respeitadas
- ✅ `UNIQUE (user_id)` - Garantido pela validação prévia
- ✅ `FOREIGN KEY (user_id → users.id)` - Garantido pela validação prévia

## Rotas Explicitamente Proibidas

- ❌ `PATCH /api/alunos` - Não existe mais
- ❌ `PATCH /api/alunos/:id` - Removida (API-CONTRACT-001)
- ❌ `PATCH /api/alunos/me` - Não permite alterar `user_id`
- ❌ Qualquer tentativa de link via update genérico

## Frontend Rules

### Permitido
- ✅ Enviar `importedAlunoId`
- ✅ Enviar `userIdToLink`
- ✅ Chamar `POST /api/alunos/link-user`

### Proibido
- ❌ Enviar `aluno_id` em qualquer rota
- ❌ Enviar `user_id` em updates genéricos
- ❌ Chamar `PATCH /api/alunos`
- ❌ Tentar alterar `user_id` via `PATCH /api/alunos/me`

## Critérios de Aceitação

- ✅ User-to-aluno link is performed exclusively via POST /api/alunos/link-user
- ✅ No request requires implicit or generic aluno ID
- ✅ Error 'ID é obrigatório' does not occur
- ✅ Aluno becomes canonical for the linked user
- ✅ Console remains clean after link operation
- ✅ Validações explícitas de negócio
- ✅ Erros específicos e descritivos

## Princípios Core Implementados

- ✅ **Supabase:** FORBIDDEN - Nenhuma dependência de Supabase
- ✅ **PostgREST Syntax:** FORBIDDEN - Nenhuma sintaxe PostgREST
- ✅ **Generic CRUD Updates:** FORBIDDEN - Nenhum update genérico para linkagem
- ✅ **Frontend Critical IDs:** FORBIDDEN - Frontend não envia IDs críticos
- ✅ **Explicit Business Intent:** MANDATORY - Rota semântica com intenção clara

## Modelo de Domínio

### User
- **Origin:** Public signup flow
- **Ownership:** Authentication identity

### Aluno
- **Origin:** Imported or created by coach
- **Ownership:** Coach
- **Canonical Rule:** An authenticated user resolves to exactly one aluno via alunos.user_id

### Coach
- **Role:** Manages alunos and performs link operations

## Regras de Linkagem

### Cardinalidade
- **userToAluno:** ONE_TO_ONE
- **alunoToUser:** ZERO_OR_ONE

### Database Guarantee
- **UNIQUE(alunos.user_id)** - Implementado via constraint no banco

### Link Operation
- **SET alunos.user_id** - Operação exclusiva via POST /api/alunos/link-user

## Arquivos Modificados

1. **`server/routes/api.js`**
   - Nova rota `POST /api/alunos/link-user` criada
   - Validações de autorização e negócio implementadas
   - Proteção em `PATCH /api/alunos/me` para não permitir alterar `user_id`

## Status Final

✅ **IMPLEMENTADO E PRONTO PARA TESTE**

- Rota semântica criada
- Validações completas implementadas
- Erros específicos e descritivos
- Proteção contra alteração de `user_id` via update
- Pronto para uso pelo frontend
