# ✅ Fix coach_id Foreign Key Violation - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problema

**Erro ao inserir em feedbacks_alunos**:
```
Error: insert or update on table "feedbacks_alunos" violates foreign key constraint "feedbacks_alunos_coach_id_fkey"
```

**Causa**: O `coach_id` enviado era `00000000-0000-0000-0000-000000000000`, que não existe na tabela `auth.users` (referência da foreign key).

---

## 🔍 Causa Raiz

**Arquivo**: `/root/server/index.js` (linha 507-606)

**Problema**:
- Frontend envia `coach_id: "00000000-0000-0000-0000-000000000000"` (UUID inválido/placeholder)
- Backend aceita sem validação
- PostgreSQL rejeita porque não existe na tabela `auth.users(id)`
- Foreign key constraint `feedbacks_alunos_coach_id_fkey` violada

**Tabela `feedbacks_alunos`**:
```sql
coach_id uuid NOT NULL,  -- Sem foreign key explícita na migração original, mas há constraint
```

**Outras migrações** mostram que `coach_id` deve referenciar `auth.users(id)`.

---

## ✅ Correção Implementada

### Mudança em `/root/server/index.js`

**COACH-01: Sempre usar userId autenticado para coach_id**

**Antes**:
```javascript
app.post('/rest/v1/:table', authenticate, async (req, res) => {
    const data = req.body;
    // ❌ Aceita qualquer coach_id sem validação
    // ❌ Pode aceitar UUID inválido como "00000000-0000-0000-0000-000000000000"
});
```

**Depois**:
```javascript
app.post('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const data = req.body;
    const userId = req.user?.id; // ID do usuário autenticado
    
    // COACH-01: Sempre usar userId autenticado para coach_id
    if (data.coach_id === '00000000-0000-0000-0000-000000000000' || 
        data.coach_id === null || 
        data.coach_id === undefined ||
        !data.coach_id ||
        data.coach_id === '') {
        // Para tabelas que têm coach_id, usar sempre o userId autenticado
        const tablesWithCoachId = ['feedbacks_alunos', 'alunos', 'fotos_alunos', 'alunos_treinos'];
        if (tablesWithCoachId.includes(table) || 'coach_id' in data) {
            data.coach_id = userId;
            logger.info('COACH-01: coach_id corrigido para userId autenticado');
        }
    } else if (data.coach_id && data.coach_id !== userId) {
        // Por segurança, sempre usar userId do usuário autenticado
        logger.warn('COACH-01: coach_id fornecido difere do userId autenticado, usando userId');
        data.coach_id = userId;
    }
    // ... resto do código
});
```

---

## ✅ Validações

### 1. Código
- ✅ `coach_id` inválido substituído por `userId`
- ✅ `userId` extraído de `req.user.id` (autenticado)
- ✅ Validação para múltiplas tabelas
- ✅ Logs detalhados para debugging

### 2. Segurança
- ✅ Sempre usa `userId` autenticado (não aceita `coach_id` externo)
- ✅ Previne falsificação de `coach_id`
- ✅ Garante que feedbacks são criados pelo usuário correto

### 3. Tabelas Afetadas
- ✅ `feedbacks_alunos`
- ✅ `alunos`
- ✅ `fotos_alunos`
- ✅ `alunos_treinos`

---

## 📋 Fluxo Corrigido

### Antes (Problemático)

```
1. Frontend envia: { coach_id: "00000000-0000-0000-0000-000000000000", ... }
2. Backend aceita sem validação
3. INSERT INTO feedbacks_alunos (coach_id, ...) VALUES ('00000000...', ...)
4. ❌ PostgreSQL rejeita: foreign key violation
5. Erro 500 retornado
```

### Depois (Correto)

```
1. Frontend envia: { coach_id: "00000000-0000-0000-0000-000000000000", ... }
2. Backend detecta coach_id inválido
3. Backend substitui por req.user.id (autenticado)
4. INSERT INTO feedbacks_alunos (coach_id, ...) VALUES (userId_real, ...)
5. ✅ PostgreSQL aceita (userId existe em auth.users)
6. Sucesso retornado
```

---

## 📋 Checklist

- [x] COACH-01: Validar coach_id inválido
- [x] COACH-01: Substituir por userId autenticado
- [x] COACH-01: Validar para múltiplas tabelas
- [x] COACH-01: Logs detalhados adicionados
- [x] Servidor reiniciado
- [x] Código validado

---

## 🎉 Resultado

**Foreign key violation corrigida!**

- ✅ `coach_id` inválido substituído por `userId` autenticado
- ✅ Feedbacks podem ser criados sem erro
- ✅ Segurança garantida (sempre usa usuário autenticado)
- ✅ Logs detalhados para debugging

---

**Última atualização**: 15 de Janeiro de 2026 - 18:25
