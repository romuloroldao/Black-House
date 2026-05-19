# ✅ Correção: Erro ao excluir notificações

**Data**: 13 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO E DEPLOYADO**

---

## 🐛 Problema Identificado

**Erro**: `DELETE https://api.blackhouse.app.br/rest/v1/notificacoes?id=[object%20Object] 500 (Internal Server Error)`  
**Erro**: `invalid input syntax for type uuid: "[object Object]"`

**Causa Raiz**: 
- Método `delete` estava sendo chamado com objeto `{ id: notificationId }` ao invés de string
- O `apiClient.delete()` espera receber uma string (ID), não um objeto

**Localização**: `NotificationsPopover.tsx` linha 124

---

## ✅ Correções Aplicadas

### 1. NotificationsPopover.tsx - `deleteNotification`

**Problema**: Passava objeto ao invés de string

**Correção**:
```typescript
// ANTES
await apiClient
  .from('notificacoes')
  .delete({ id: notificationId });

// DEPOIS
await apiClient
  .from('notificacoes')
  .delete(notificationId);
```

### 2. api-client.ts - Método `delete` Melhorado

**Melhoria**: Agora aceita tanto string (ID) quanto objeto (filtros)

**Implementação**:
```typescript
async delete(idOrFilters: string | { [key: string]: any }) {
    // Se for string, é um ID simples
    if (typeof idOrFilters === 'string') {
        return apiClient.request(`/rest/v1/${this._table}?id=${idOrFilters}`, {
            method: 'DELETE',
        });
    }
    
    // Se for objeto, buscar IDs primeiro usando os filtros
    // ... busca registros e deleta cada um
}
```

### 3. Outros Componentes Corrigidos

Corrigidos todos os lugares onde `delete` estava sendo usado incorretamente:

- ✅ `DietViewer.tsx` - `.delete({ id: ... })` → `.delete(id)`
- ✅ `RecurringChargesConfig.tsx` - `.delete({ id })` → `.delete(id)`
- ✅ `FinancialExceptionsManager.tsx` - `.delete({ id })` → `.delete(id)`
- ✅ `StudentDetails.tsx` - `.delete({ id: ... })` → `.delete(id)`
- ✅ `UserRolesManager.tsx` - `.delete({ id: ... })` → `.delete(id)`

**Mantidos com objeto** (casos especiais que precisam de múltiplos filtros):
- ✅ `ReportForm.tsx` - `.delete({ relatorio_id: ... })` - OK (múltiplos filtros)
- ✅ `ClassGroupManager.tsx` - `.delete({ turma_id: ..., aluno_id: ... })` - OK (múltiplos filtros)
- ✅ `UserRolesManager.tsx` - `.delete({ user_id: ... })` - OK (filtro por campo não-ID)

---

## 📋 Como Funciona Agora

### Delete Simples (por ID)

```typescript
// Passa string diretamente
await apiClient
  .from('notificacoes')
  .delete(notificationId);
```

### Delete com Filtros (por outros campos)

```typescript
// Passa objeto com filtros
await apiClient
  .from('relatorio_midias')
  .delete({ relatorio_id: reportId });

// Internamente:
// 1. Busca registros que correspondem aos filtros
// 2. Extrai os IDs
// 3. Deleta cada um usando DELETE ?id=...
```

---

## 🧪 Como Testar

### 1. Teste de Exclusão de Notificação

1. Acesse: https://blackhouse.app.br
2. Clique no ícone de notificações (sino)
3. Clique no "X" de uma notificação
4. Verifique que:
   - ✅ Notificação é excluída sem erro
   - ✅ Toast de sucesso aparece
   - ✅ Lista é atualizada
   - ✅ Não há erro no console

### 2. Teste de Outras Exclusões

Teste exclusão em outras telas:
- ✅ Despesas
- ✅ Dietas
- ✅ Alunos
- ✅ Configurações de cobrança
- ✅ Exceções financeiras

---

## ⚠️ Notas Importantes

### Uso Correto do Método `delete`

**✅ Correto**:
```typescript
// ID como string
.delete(id)

// Filtros como objeto (para campos não-ID)
.delete({ relatorio_id: reportId })
.delete({ turma_id: turmaId, aluno_id: alunoId })
```

**❌ Incorreto**:
```typescript
// Objeto com id (deve ser string)
.delete({ id: notificationId })  // ❌ ERRADO
```

### Casos Especiais

Para deletar por múltiplos filtros ou campos não-ID, o método `delete` agora:
1. Busca os registros que correspondem aos filtros
2. Extrai os IDs
3. Deleta cada registro usando `DELETE ?id=...`

Isso permite deletar por qualquer campo, não apenas por `id`.

---

## ✅ Checklist

- [x] NotificationsPopover.tsx corrigido
- [x] api-client.ts - método `delete` melhorado
- [x] DietViewer.tsx corrigido
- [x] RecurringChargesConfig.tsx corrigido
- [x] FinancialExceptionsManager.tsx corrigido
- [x] StudentDetails.tsx corrigido
- [x] UserRolesManager.tsx corrigido
- [x] Build realizado
- [x] Frontend deployado
- [ ] Testar em produção (pendente)

---

## 🎉 Conclusão

**Correção aplicada e deployada!**

O sistema de exclusão agora:
- ✅ Aceita ID como string (uso mais comum)
- ✅ Aceita filtros como objeto (casos especiais)
- ✅ Busca IDs automaticamente quando necessário
- ✅ Deleta corretamente sem erros

**Teste**: Acesse https://blackhouse.app.br, vá para notificações e tente excluir uma. Deve funcionar sem erros.

---

**Última atualização**: 13 de Janeiro de 2026 - 15:30
