# 📋 Plano de Migração: Componentes Restantes

**Data**: 12 de Janeiro de 2026  
**Status**: 🟡 **EM ANÁLISE**

---

## 🔍 COMPONENTES IDENTIFICADOS COM SUPABASE

### Componentes com Referências ao Supabase:

1. **WorkoutForm.tsx** - 4 referências
   - `supabase.auth.getUser()` - usar `useAuth()`
   - `supabase.from('treinos').insert/update()` - migrar para `apiClient`

2. **UserLinkingManager.tsx** - 5 referências
   - `supabase.auth.getUser()` - usar `useAuth()`
   - `supabase.from('alunos').select()` - migrar para `apiClient`
   - `supabase.from('user_roles').select()` - migrar para `apiClient`
   - `supabase.from('user_roles').insert()` - migrar para `apiClient`

3. **UserRolesManager.tsx** - 8 referências
   - Múltiplas queries e updates
   - Precisa migração completa

4. **ReportForm.tsx** - 9 referências
   - Upload de arquivos
   - Múltiplas queries e inserts
   - Precisa migração completa

5. **StudentDetails.tsx** - 15 referências ⚠️ (MAIS COMPLEXO)
   - Múltiplas queries
   - Upload de arquivos
   - Auth.getUser()
   - Criar conversas
   - Precisa migração completa

6. **ExpenseManager.tsx** - 5 referências
   - Queries e CRUD simples
   - Migração direta

7. **AnnouncementManager.tsx** - 10 referências
   - Queries complexas com joins
   - Criar avisos e destinatários
   - Migração com queries separadas

8. **ClassGroupManager.tsx** - 9 referências
   - CRUD de turmas
   - Relacionamentos com alunos
   - Migração com queries separadas

### Componentes Já Migrados (0 referências):
- ✅ PaymentManager.tsx
- ✅ ReportViewPage.tsx
- ✅ StudentPortal.tsx
- ✅ LiveManager.tsx
- ✅ NotificationsPopover.tsx
- ✅ RecurringChargesConfig.tsx
- ✅ PaymentStatusTracker.tsx
- ✅ SearchDialog.tsx
- ✅ DietViewer.tsx
- ✅ FinancialExceptionsManager.tsx
- ✅ LiveForm.tsx

---

## 📝 ESTRATÉGIA DE MIGRAÇÃO

### Prioridade Alta (Mais Usados)
1. **StudentDetails.tsx** (15 refs) - Componente crítico
2. **ReportForm.tsx** (9 refs) - Upload de relatórios
3. **AnnouncementManager.tsx** (10 refs) - Gestão de avisos

### Prioridade Média
4. **ClassGroupManager.tsx** (9 refs)
5. **UserRolesManager.tsx** (8 refs)
6. **UserLinkingManager.tsx** (5 refs)

### Prioridade Baixa
7. **ExpenseManager.tsx** (5 refs)
8. **WorkoutForm.tsx** (4 refs)

---

## 🔄 PADRÕES A APLICAR

### 1. Auth.getUser() → useAuth()
### 2. Queries Simples → apiClient
### 3. Joins → Queries Separadas
### 4. Upload → apiClient.uploadFile()
### 5. Batch Operations → Loops Individuais

---

## 📁 ARQUIVOS DE INTEGRAÇÃO

### Análise Necessária:
- `src/integrations/supabase/client.ts` - Pode ser removido ou adaptado
- `src/integrations/supabase/types.ts` - Pode ser útil manter tipos se necessário

**Decisão**: Após migração completa, remover ou criar versão adaptada se necessário.

---

**Próximo Passo**: Migrar componentes prioritários um por um.
