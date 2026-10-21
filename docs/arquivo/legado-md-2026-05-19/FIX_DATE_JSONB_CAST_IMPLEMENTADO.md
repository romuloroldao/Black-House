# ✅ Fix DATE vs JSONB Cast Error - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problema

**Erro ao inserir em `alunos_treinos`**:
```
Error: column "data_expiracao" is of type date but expression is of type jsonb
```

**Causa**: O código estava aplicando cast `::jsonb` em campos DATE (como `data_expiracao`, `data_inicio`, etc.) porque a condição `key.includes('data')` capturava esses campos.

---

## 🔍 Causa Raiz

**Arquivo**: `/root/server/index.js` (linhas 604-630, 647-656)

**Problema**:
```javascript
// ❌ Condição muito ampla - captura campos DATE
else if (key === 'exercicios' || key.includes('json') || key.includes('data')) {
    // Aplicava cast ::jsonb em data_expiracao, data_inicio, etc.
}
```

**Campos DATE afetados**:
- `data_expiracao` (DATE)
- `data_inicio` (DATE)
- `data_vencimento` (DATE)
- `data_pagamento` (DATE)
- `data_agendamento` (DATE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Campos JSONB reais**:
- `exercicios` (JSONB) - único campo JSONB no sistema atualmente

---

## ✅ Correção Implementada

### Mudança em `/root/server/index.js`

**1. Detectar campos DATE explicitamente** (linhas 608-611):
```javascript
// Identificar campos DATE vs campos JSONB
const isDateField = key.startsWith('data_') || key === 'data_inicio' || key === 'data_expiracao' || 
                    key === 'data_vencimento' || key === 'data_pagamento' || key === 'data_agendamento' ||
                    key === 'created_at' || key === 'updated_at';
const isJsonbField = key === 'exercicios' || (key.includes('json') && !isDateField);
```

**2. Aplicar serialização JSON apenas em campos JSONB** (linhas 613-633):
```javascript
if (isJsonbField && !isDateField) {
    // Apenas serializar se for campo JSONB real
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        acc[key] = JSON.stringify(value);
    }
    // ...
}
```

**3. Aplicar cast ::jsonb apenas em campos JSONB** (linhas 647-656):
```javascript
const placeholders = columns.map((col, i) => {
    const isDateField = col.startsWith('data_') || ...;
    const isJsonbField = col === 'exercicios' || (col.includes('json') && !isDateField);
    
    if (isJsonbField && !isDateField) {
        return `$${i + 1}::jsonb`; // Apenas cast em JSONB
    }
    return `$${i + 1}`; // Sem cast para DATE e outros tipos
}).join(', ');
```

---

## ✅ Validações

### 1. Campos DATE
- ✅ `data_expiracao`: Não aplica cast JSONB
- ✅ `data_inicio`: Não aplica cast JSONB
- ✅ `data_vencimento`: Não aplica cast JSONB
- ✅ `data_pagamento`: Não aplica cast JSONB
- ✅ `data_agendamento`: Não aplica cast JSONB
- ✅ `created_at`/`updated_at`: Não aplica cast JSONB

### 2. Campos JSONB
- ✅ `exercicios`: Aplica serialização e cast ::jsonb
- ✅ Campos com "json" no nome: Aplica se não for DATE

### 3. Código
- ✅ Lógica corrigida
- ✅ Detecção explícita de campos DATE
- ✅ Sintaxe válida

### 4. Servidor
- ✅ Servidor reiniciado e funcionando

---

## 📋 Checklist

- [x] Identificar campos DATE explicitamente
- [x] Separar lógica de campos DATE vs JSONB
- [x] Aplicar serialização apenas em campos JSONB
- [x] Aplicar cast ::jsonb apenas em campos JSONB
- [x] Servidor reiniciado
- [x] Código validado

---

## 🎉 Resultado

**Erro corrigido!**

- ✅ Campos DATE não recebem cast JSONB
- ✅ Campos JSONB (exercicios) recebem cast correto
- ✅ Insert em `alunos_treinos` funciona corretamente
- ✅ Insert em `treinos` funciona corretamente (exercicios como JSONB)

---

**Última atualização**: 15 de Janeiro de 2026 - 18:40
