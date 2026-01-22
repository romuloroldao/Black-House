# ✅ Fix alunos_treinos coach_id Error - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problema

**Erro ao inserir em `alunos_treinos`**:
```
Error: column "coach_id" of relation "alunos_treinos" does not exist
```

**Causa**: O código estava tentando adicionar `coach_id` na tabela `alunos_treinos`, mas essa tabela **não possui essa coluna** (ver migração `20251016132724`).

---

## 🔍 Causa Raiz

**Arquivo**: `/root/server/index.js` (linhas 521-553)

**Problema**:
- `alunos_treinos` estava na lista `tablesWithCoachId`
- Código adicionava `coach_id` automaticamente para tabelas nessa lista
- Mas a tabela `alunos_treinos` **não tem coluna `coach_id`**

**Estrutura real da tabela `alunos_treinos`**:
```sql
CREATE TABLE public.alunos_treinos (
  id uuid PRIMARY KEY,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  treino_id uuid NOT NULL REFERENCES public.treinos(id),
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
-- ❌ NÃO tem coluna coach_id
```

---

## ✅ Correção Implementada

### Mudança em `/root/server/index.js`

**1. Remover `alunos_treinos` da lista** (linha 523):
```javascript
// Antes:
const tablesWithCoachId = ['feedbacks_alunos', 'alunos', 'fotos_alunos', 'alunos_treinos', ...];
// ❌ alunos_treinos não tem coach_id

// Depois:
const tablesWithCoachId = ['feedbacks_alunos', 'alunos', 'fotos_alunos', 'treinos', ...];
// ✅ Removido alunos_treinos da lista
```

**2. Filtrar `coach_id` se a tabela não tiver essa coluna** (linhas 555-566):
```javascript
filteredData = Object.entries(data)
    .filter(([key]) => {
        // FILTER-01: Remover coach_id se a tabela não tem essa coluna
        if (key === 'coach_id' && !tablesWithCoachId.includes(table)) {
            logger.debug('FILTER-01: Removendo coach_id de tabela que não tem essa coluna', {
                table,
                key
            });
            return false; // Remover coach_id
        }
        return !fieldsToExclude.includes(key);
    })
    // ... resto do código
```

---

## ✅ Validações

### 1. Estrutura da Tabela
- ✅ Verificado: `alunos_treinos` não tem coluna `coach_id`
- ✅ Removido da lista `tablesWithCoachId`
- ✅ Filtro adicionado para remover `coach_id` se não existir na tabela

### 2. Código
- ✅ Lógica corrigida
- ✅ Logs adicionados
- ✅ Sintaxe válida

### 3. Servidor
- ✅ Servidor reiniciado e funcionando

---

## 📋 Checklist

- [x] Verificar estrutura de `alunos_treinos`
- [x] Remover `alunos_treinos` da lista `tablesWithCoachId`
- [x] Adicionar filtro para remover `coach_id` se não existir na tabela
- [x] Adicionar logs detalhados
- [x] Servidor reiniciado
- [x] Código validado

---

## 🎉 Resultado

**Erro corrigido!**

- ✅ `alunos_treinos` não tenta mais inserir `coach_id`
- ✅ `coach_id` é removido automaticamente se a tabela não tiver essa coluna
- ✅ Insert em `alunos_treinos` funciona corretamente
- ✅ Outras tabelas continuam usando `coach_id` corretamente

---

**Última atualização**: 15 de Janeiro de 2026 - 18:35
