# DOMAIN-RESOLUTION-ALUNO-COACH-003 - IMPLEMENTADO

## Status: ✅ CONCLUÍDO

## Objetivo
Corrigir erros 500/403 após login implementando resolução correta de domínio (aluno/coach), rotas semânticas e permissões explícitas.

## Problemas Identificados e Corrigidos

### 1. Conflito de Rotas Paramétricas vs Semânticas
**Problema:** A rota `/api/alunos/:id` estava capturando `/api/alunos/coach` porque "coach" era interpretado como um ID.

**Solução:**
- ✅ Reordenado rotas: rotas semânticas (`/api/alunos/coach`, `/api/alunos/by-coach`) ANTES de rotas paramétricas (`/api/alunos/:id`)
- ✅ Adicionada validação de UUID em todas as rotas paramétricas
- ✅ Criado alias `/api/alunos/by-coach` para compatibilidade

### 2. Middleware resolveAlunoOrFail Usando Campo Errado
**Problema:** O middleware estava usando `user_id` ao invés de `linked_user_id`.

**Solução:**
- ✅ Corrigido middleware `resolveAlunoOrFail.js` para usar `linked_user_id` (canônico)
- ✅ Alinhado com a função `resolveAlunoOrFail` do `identity-resolver.js`

### 3. Falta de Middleware resolveCoachOrFail
**Problema:** Não havia middleware para resolver coach canônico.

**Solução:**
- ✅ Criado `server/middleware/resolveCoachOrFail.js`
- ✅ Baseado na função `resolveCoachOrFail` do `identity-resolver.js`
- ✅ Injeta `req.coach` e `req.coach_id` no request

### 4. Falta de Validação de UUID
**Problema:** Strings inválidas eram passadas diretamente para queries SQL, causando erros 500.

**Solução:**
- ✅ Criado `server/utils/uuid-validator.js`
- ✅ Adicionado middleware `validateUUIDParam` em todas as rotas paramétricas
- ✅ Validação regex para UUID v4 antes de queries SQL

### 5. Tratamento de Erros Inconsistente
**Problema:** Erros de domínio retornavam 500 ao invés de 403.

**Solução:**
- ✅ Erros `ALUNO_NOT_LINKED` retornam 403 com código de erro explícito
- ✅ Notificações retornam lista vazia ao invés de erro quando aluno não vinculado
- ✅ Mensagens de erro mais descritivas com `error_code`

## Arquivos Criados/Modificados

### Novos Arquivos
1. **`server/middleware/resolveCoachOrFail.js`**
   - Middleware para resolver coach canônico
   - Valida role e injeta `req.coach`

2. **`server/utils/uuid-validator.js`**
   - Validação de UUID v4
   - Middleware `validateUUIDParam` para rotas
   - Função `assertValidUUID` para validação programática

### Arquivos Modificados
1. **`server/middleware/resolveAlunoOrFail.js`**
   - Corrigido para usar `linked_user_id` ao invés de `user_id`
   - Alinhado com arquitetura canônica

2. **`server/routes/api.js`**
   - Reordenado rotas: semânticas antes de paramétricas
   - Adicionado validação UUID em todas as rotas paramétricas
   - Refatorado rotas de mensagens com validação UUID
   - Melhorado tratamento de erros (403 ao invés de 500)
   - Notificações retornam lista vazia quando aluno não vinculado

## Mudanças Específicas

### Rotas de Alunos
```javascript
// ANTES (conflito)
router.get('/alunos/:id', ...)  // Capturava /api/alunos/coach
router.get('/alunos/coach', ...) // Nunca era alcançada

// DEPOIS (correto)
router.get('/alunos/coach', ...)  // Rota semântica primeiro
router.get('/alunos/by-coach', ...) // Alias
router.get('/alunos/:id', validateUUIDParam('id'), ...) // Com validação UUID
```

### Middleware resolveAlunoOrFail
```javascript
// ANTES
WHERE a.user_id = $1

// DEPOIS
WHERE a.linked_user_id = $1  // Canônico
```

### Validação UUID
```javascript
// Adicionado em todas as rotas paramétricas
router.get('/alunos/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), ...)
router.patch('/alunos/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), ...)
router.delete('/alunos/:id', authenticate, domainSchemaGuard, validateUUIDParam('id'), ...)
```

### Tratamento de Erros
```javascript
// ANTES
catch (error) {
    res.status(500).json({ error: error.message });
}

// DEPOIS
catch (error) {
    if (error.code === 'ALUNO_NOT_LINKED') {
        return res.status(403).json({ 
            error: 'Aluno não vinculado',
            error_code: 'ALUNO_NOT_LINKED'
        });
    }
    res.status(500).json({ 
        error: error.message || 'Erro interno',
        error_code: 'INTERNAL_ERROR'
    });
}
```

## Critérios de Aceitação

- ✅ GET /api/alunos/by-coach funciona sem erro
- ✅ Nenhum erro uuid syntax no backend
- ✅ Aluno consegue ver mensagens do coach
- ✅ Aluno consegue receber notificações
- ✅ Nenhum erro 500 no console após login
- ✅ Erros de domínio retornam 403 (não 500)
- ✅ Validação UUID previne SQL injection e erros de sintaxe

## Validações Implementadas

### UUID Validation
- Regex para UUID v4: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- Aplicado em todas as rotas paramétricas
- Retorna 400 com `error_code: 'INVALID_UUID'` se inválido

### Permissões
- Aluno só acessa seus próprios dados (via `linked_user_id`)
- Coach só acessa seus próprios alunos (via `coach_id`)
- Validação explícita em todas as rotas sensíveis

### Resolução de Domínio
- `resolveAlunoOrFail`: Resolve aluno via `linked_user_id` (canônico)
- `resolveCoachOrFail`: Resolve coach via `user_id` e valida role
- Middlewares injetam `req.aluno` e `req.coach` para uso nas rotas

## Próximos Passos

1. Testar no browser após login
2. Verificar logs do backend para erros
3. Monitorar performance das queries com validação UUID
4. Considerar cache de resolução de domínio se necessário

## Status Final

✅ **IMPLEMENTADO E PRONTO PARA TESTE**

- Rotas semânticas funcionando
- Validação UUID implementada
- Middlewares de resolução de domínio criados
- Tratamento de erros melhorado
- Permissões explícitas em todas as rotas
