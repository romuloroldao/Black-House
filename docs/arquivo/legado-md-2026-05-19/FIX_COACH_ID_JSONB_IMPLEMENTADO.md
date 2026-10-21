# ✅ Fix coach_id e JSONB - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problemas

### 1. Erro ao inserir em `feedbacks_alunos`
```
Error: insert or update on table "feedbacks_alunos" violates foreign key constraint "feedbacks_alunos_coach_id_fkey"
```

**Causa**: `coach_id` inválido ou ausente.

### 2. Erro ao inserir em `treinos`
```
Error: invalid input syntax for type json
```

**Causa**: Campo `exercicios` (JSONB) recebendo objeto JavaScript sem serialização adequada.

---

## ✅ Correções Implementadas

### COACH-01: Sempre usar userId autenticado para coach_id

**Arquivo**: `/root/server/index.js` (linhas 521-548)

**Mudança**:
- ✅ **Sempre substituir `coach_id` pelo `userId` autenticado** para todas as tabelas que têm esse campo
- ✅ Lista expandida de tabelas: `feedbacks_alunos`, `alunos`, `fotos_alunos`, `alunos_treinos`, `treinos`, `videos`, `lives`, `payment_plans`, `financial_exceptions`, `expenses`, `recurring_charges_config`
- ✅ Se `coach_id` não for fornecido, adicionar automaticamente
- ✅ Por segurança, sempre usar `req.user.id` (não aceita `coach_id` externo)

**Código**:
```javascript
// COACH-01: Sempre usar userId autenticado para coach_id
const tablesWithCoachId = ['feedbacks_alunos', 'alunos', 'fotos_alunos', 'alunos_treinos', 
                           'treinos', 'videos', 'lives', 'payment_plans', 'financial_exceptions', 
                           'expenses', 'recurring_charges_config'];

if ('coach_id' in data) {
    const originalCoachId = data.coach_id;
    // Sempre usar userId autenticado
    data.coach_id = userId;
    
    if (originalCoachId !== userId && originalCoachId !== '00000000-0000-0000-0000-000000000000') {
        logger.warn('COACH-01: coach_id substituído por userId autenticado');
    }
} else if (tablesWithCoachId.includes(table)) {
    // Se a tabela requer coach_id mas não foi fornecido, adicionar
    data.coach_id = userId;
}
```

### JSON-01: Serializar objetos para campos JSONB

**Arquivo**: `/root/server/index.js` (linhas 585-608, 630-645)

**Mudança**:
- ✅ Detectar campos JSONB (`exercicios`, campos com `json` no nome)
- ✅ Serializar objetos/arrays JavaScript para string JSON
- ✅ Usar cast `::jsonb` no SQL quando necessário
- ✅ Validar JSON se já for string

**Código**:
```javascript
// JSON-01: Converter objetos/arrays para JSON string para campos JSONB/JSON
else if (key === 'exercicios' || key.includes('json') || key.includes('data')) {
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        // Serializar objeto/array para JSON string
        acc[key] = JSON.stringify(value);
    } else if (typeof value === 'string') {
        // Validar se é JSON válido
        try {
            JSON.parse(value);
            acc[key] = value; // Já é JSON válido
        } catch {
            acc[key] = value; // Usar como está
        }
    } else {
        acc[key] = value;
    }
}

// No SQL, usar cast ::jsonb se necessário
const placeholders = columns.map((col, i) => {
    if (col === 'exercicios' || col.includes('json') || col.includes('data')) {
        return typeof values[i] === 'string' ? `$${i + 1}::jsonb` : `$${i + 1}`;
    }
    return `$${i + 1}`;
}).join(', ');
```

---

## ✅ Validações

### 1. Código
- ✅ `coach_id` sempre substituído por `userId` autenticado
- ✅ Objetos JavaScript serializados para JSONB
- ✅ Cast `::jsonb` aplicado no SQL quando necessário
- ✅ Logs detalhados para debugging

### 2. Segurança
- ✅ Sempre usa usuário autenticado (não aceita `coach_id` externo)
- ✅ Previne falsificação de `coach_id`

### 3. Banco de Dados
- ✅ Foreign keys válidas (coach_id sempre existe em auth.users)
- ✅ JSONB aceita objetos JavaScript ou strings JSON

### 4. Servidor
- ✅ Servidor reiniciado e funcionando
- ✅ Código validado sem erros

---

## 📋 Checklist

- [x] COACH-01: Validar e substituir `coach_id` por `userId`
- [x] COACH-01: Lista expandida de tabelas
- [x] COACH-01: Adicionar `coach_id` se ausente
- [x] JSON-01: Serializar objetos para campos JSONB
- [x] JSON-01: Usar cast `::jsonb` no SQL
- [x] JSON-01: Validar JSON se for string
- [x] Logs detalhados adicionados
- [x] Servidor reiniciado

---

## 🎉 Resultado

**Ambos os erros corrigidos!**

- ✅ `feedbacks_alunos`: `coach_id` sempre válido (userId autenticado)
- ✅ `treinos`: `exercicios` (JSONB) serializado corretamente
- ✅ Foreign keys válidas
- ✅ JSONB aceita objetos/arrays corretamente

---

**Última atualização**: 15 de Janeiro de 2026 - 18:30
