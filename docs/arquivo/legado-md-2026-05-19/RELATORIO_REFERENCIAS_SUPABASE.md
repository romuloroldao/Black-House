# 📊 Relatório: Referências ao Supabase no Código

**Data**: 12 de Janeiro de 2026  
**Comando**: `grep -R -E "supabase\.|@/integrations/supabase" src/ --line-number`

---

## 📈 ESTATÍSTICAS

- **Total de referências encontradas**: 61 linhas
- **Arquivos únicos com referências**: 28 arquivos
- **Arquivos de integração**: 2 (`client.ts`, `types.ts`)
- **Scripts**: 2 (`import-taco-foods.ts`, `import-alimentos.ts`)

---

## 📁 ARQUIVOS COM REFERÊNCIAS AO SUPABASE

### 🔴 Componentes Principais (Coach)

1. **AnnouncementManager.tsx** - 1 import
2. **ClassGroupManager.tsx** - 1 import
3. **DietViewer.tsx** - 1 import
4. **EventsCalendar.tsx** - 1 import + 3 usos (insert)
5. **ExpenseManager.tsx** - 1 import
6. **FinancialExceptionsManager.tsx** - 1 import
7. **LiveManager.tsx** - 1 import
8. **NotificationsPopover.tsx** - 1 import + 1 uso (removeChannel)
9. **PaymentStatusTracker.tsx** - 1 import
10. **PlanManager.tsx** - 1 import + 3 usos (select)
11. **RecurringChargesConfig.tsx** - 1 import
12. **ReportForm.tsx** - 1 import
13. **SearchDialog.tsx** - 1 import
14. **SettingsManager.tsx** - 2 usos (auth.updateUser)
15. **Sidebar.tsx** - 1 import + 5 usos (channel, removeChannel, auth.getUser)
16. **StudentDetails.tsx** - 1 import + 1 uso (auth.getUser)
17. **UserLinkingManager.tsx** - 1 import + 1 uso (auth.getUser)
18. **UserRolesManager.tsx** - 1 import
19. **WorkoutForm.tsx** - 1 import + 1 uso (auth.getUser)

### 🔴 Componentes do Portal do Aluno

20. **StudentSidebar.tsx** - 1 import + 5 usos (channel, removeChannel, auth.getUser)
21. **StudentFinancialView.tsx** - 1 import
22. **StudentFinancialManagement.tsx** - 1 import + 1 uso (functions.invoke)
23. **StudentChatView.tsx** - 1 import + 2 usos (removeChannel, insert)
24. **MessagesPopover.tsx** - 1 import + 1 uso (removeChannel)
25. **StudentWeeklyCheckin.tsx** - 1 import + 2 usos (auth.getUser, insert)

### 🔴 Páginas

26. **ReportViewPage.tsx** - 1 import
27. **StudentPortal.tsx** - 1 import

### 🔴 Scripts (Node.js)

28. **import-taco-foods.ts** - Cliente Supabase direto
29. **import-alimentos.ts** - Cliente Supabase direto + RPC

### 🔴 Integrações

30. **integrations/supabase/client.ts** - Cliente Supabase
31. **integrations/supabase/types.ts** - Tipos TypeScript

---

## 🔍 TIPOS DE USO IDENTIFICADOS

### 1. Imports (28 arquivos)
```typescript
import { supabase } from "@/integrations/supabase/client";
```

### 2. Autenticação (6 usos)
- `supabase.auth.getUser()` - 4 usos
- `supabase.auth.updateUser()` - 2 usos

**Arquivos**:
- SettingsManager.tsx (2x)
- Sidebar.tsx (1x)
- StudentSidebar.tsx (1x)
- StudentDetails.tsx (1x)
- UserLinkingManager.tsx (1x)
- WorkoutForm.tsx (1x)
- StudentWeeklyCheckin.tsx (1x)

### 3. Realtime/Channels (10 usos)
- `supabase.channel()` - 2 usos
- `supabase.removeChannel()` - 8 usos

**Arquivos**:
- Sidebar.tsx (5x)
- StudentSidebar.tsx (4x)
- NotificationsPopover.tsx (1x)
- StudentChatView.tsx (1x)
- MessagesPopover.tsx (1x)

### 4. Database Queries (9 usos)
- `supabase.from().select()` - 3 usos (PlanManager)
- `supabase.from().insert()` - 4 usos
- `supabase.from().update()` - 0 usos (já migrados)
- `supabase.from().delete()` - 0 usos (já migrados)

**Arquivos**:
- PlanManager.tsx (3x select)
- EventsCalendar.tsx (3x insert)
- StudentChatView.tsx (1x insert)
- StudentWeeklyCheckin.tsx (1x insert)

### 5. Edge Functions (1 uso)
- `supabase.functions.invoke()` - 1 uso

**Arquivos**:
- StudentFinancialManagement.tsx (create-asaas-payment)

### 6. RPC (1 uso)
- `supabase.rpc()` - 1 uso

**Arquivos**:
- import-alimentos.ts (calcular_nutrientes)

---

## 📊 RESUMO POR CATEGORIA

| Categoria | Quantidade | Status |
|-----------|-----------|--------|
| **Imports** | 28 arquivos | 🟡 Pendente |
| **Auth (getUser/updateUser)** | 6 usos | 🟡 Pendente |
| **Realtime/Channels** | 10 usos | 🔴 Crítico (remover) |
| **Database Queries** | 9 usos | 🟡 Pendente |
| **Edge Functions** | 1 uso | 🟡 Pendente |
| **RPC** | 1 uso | 🟡 Pendente |
| **Scripts** | 2 arquivos | 🟡 Decisão necessária |

---

## 🎯 PRIORIDADES DE MIGRAÇÃO

### 🔴 Alta Prioridade (Funcionalidades Críticas)

1. **Sidebar.tsx** - Realtime + Auth (5 usos)
2. **StudentSidebar.tsx** - Realtime + Auth (5 usos)
3. **SettingsManager.tsx** - Auth.updateUser (2 usos) - **JÁ PARCIALMENTE MIGRADO**

### 🟡 Média Prioridade (Funcionalidades Importantes)

4. **PlanManager.tsx** - Queries (3 usos)
5. **EventsCalendar.tsx** - Inserts (3 usos)
6. **StudentWeeklyCheckin.tsx** - Auth + Insert (2 usos)
7. **StudentChatView.tsx** - Realtime + Insert (2 usos)
8. **StudentFinancialManagement.tsx** - Edge Function (1 uso)

### 🟢 Baixa Prioridade (Funcionalidades Secundárias)

9. Todos os outros componentes com apenas imports (sem uso ativo)
10. Scripts de importação (podem manter Supabase ou migrar para API)

---

## 📝 NOTAS IMPORTANTES

### 1. Realtime (Crítico)
- **Sidebar.tsx**: 4 channels (messages, payments, students, presence)
- **StudentSidebar.tsx**: 3 channels (avisos, mensagens, presence)
- **Solução**: Remover realtime e usar polling ou WebSocket próprio

### 2. Auth.updateUser
- **SettingsManager.tsx**: Usado para atualizar metadata e senha
- **Solução**: Criar endpoints na API (`/auth/update-user`, `/auth/change-password`)

### 3. Edge Functions
- **StudentFinancialManagement.tsx**: `create-asaas-payment`
- **Solução**: Já existe endpoint `/functions/create-asaas-payment` no backend

### 4. Scripts
- **import-taco-foods.ts** e **import-alimentos.ts** usam Supabase diretamente
- **Decisão**: Manter Supabase apenas para scripts OU migrar para usar API local

---

## ✅ PROGRESSO ATUAL

- **Componentes Críticos (Fase 1)**: ✅ 100% migrado
- **Componentes Essenciais (Fase 2)**: ✅ 100% migrado
- **Portal do Aluno (Fase 3)**: 🟡 60% migrado (9/15)
- **Componentes Secundários (Fase 4)**: 🟡 75% migrado (3/4)

**Total estimado**: ~65% do código migrado

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

1. **Finalizar SettingsManager.tsx** (2 refs restantes - auth.updateUser)
2. **Migrar Sidebar.tsx** (remover realtime, usar useAuth)
3. **Migrar StudentSidebar.tsx** (remover realtime, usar useAuth)
4. **Migrar componentes restantes** (PlanManager, EventsCalendar, etc.)
5. **Decidir sobre scripts** (manter Supabase ou migrar)

---

**Última atualização**: 12 de Janeiro de 2026
