# 📋 Arquivos Pendentes de Migração do Supabase

**Data**: 12 de Janeiro de 2026  
**Total de arquivos**: 52 arquivos ainda usam Supabase

---

## 🎯 PRIORIDADE ALTA (Funcionalidades Críticas)

### Componentes Principais
1. ✅ `src/components/VideoGallery.tsx` - **MIGRADO**
2. ✅ `src/components/VideoForm.tsx` - **MIGRADO**
3. ⚠️ `src/components/Dashboard.tsx` - Dashboard principal
4. ⚠️ `src/components/StudentManager.tsx` - Gerenciamento de alunos
5. ⚠️ `src/components/WorkoutManager.tsx` - Gerenciamento de treinos
6. ⚠️ `src/components/NutritionManager.tsx` - Gerenciamento nutricional
7. ⚠️ `src/components/PaymentManager.tsx` - Gerenciamento de pagamentos

### Páginas
8. ⚠️ `src/pages/ReportViewPage.tsx` - Visualização de relatórios
9. ⚠️ `src/pages/StudentPortal.tsx` - Portal do aluno

---

## 📦 COMPONENTES DE GESTÃO

### Alimentação e Nutrição
10. ⚠️ `src/components/FoodManager.tsx` - Gerenciamento de alimentos
11. ⚠️ `src/components/FoodReviewManager.tsx` - Revisão de alimentos
12. ⚠️ `src/components/DietCreator.tsx` - Criador de dietas
13. ⚠️ `src/components/DietViewer.tsx` - Visualizador de dietas

### Treinos
14. ⚠️ `src/components/WorkoutForm.tsx` - Formulário de treino
15. ⚠️ `src/components/WorkoutTemplates.tsx` - Templates de treino

### Financeiro
16. ⚠️ `src/components/FinancialDashboard.tsx` - Dashboard financeiro
17. ⚠️ `src/components/FinancialExceptionsManager.tsx` - Exceções financeiras
18. ⚠️ `src/components/PaymentStatusTracker.tsx` - Rastreamento de pagamentos
19. ⚠️ `src/components/PlanManager.tsx` - Gerenciamento de planos
20. ⚠️ `src/components/RecurringChargesConfig.tsx` - Configuração de cobranças recorrentes

### Comunicação
21. ⚠️ `src/components/MessageManager.tsx` - Gerenciamento de mensagens
22. ⚠️ `src/components/AnnouncementManager.tsx` - Gerenciamento de anúncios
23. ⚠️ `src/components/NotificationsPopover.tsx` - Popover de notificações

### Agenda e Eventos
24. ⚠️ `src/components/AgendaManager.tsx` - Gerenciamento de agenda
25. ⚠️ `src/components/EventsCalendar.tsx` - Calendário de eventos
26. ⚠️ `src/components/ClassGroupManager.tsx` - Gerenciamento de grupos

### Outros
27. ⚠️ `src/components/ExpenseManager.tsx` - Gerenciamento de despesas
28. ⚠️ `src/components/LiveManager.tsx` - Gerenciamento de lives
29. ⚠️ `src/components/ReportForm.tsx` - Formulário de relatório
30. ⚠️ `src/components/ReportManager.tsx` - Gerenciamento de relatórios
31. ⚠️ `src/components/SettingsManager.tsx` - Gerenciamento de configurações
32. ⚠️ `src/components/StudentDetails.tsx` - Detalhes do aluno
33. ⚠️ `src/components/UserLinkingManager.tsx` - Vinculação de usuários
34. ⚠️ `src/components/UserRolesManager.tsx` - Gerenciamento de roles
35. ⚠️ `src/components/Sidebar.tsx` - Barra lateral
36. ⚠️ `src/components/SearchDialog.tsx` - Diálogo de busca

---

## 👨‍🎓 COMPONENTES DO PORTAL DO ALUNO

37. ⚠️ `src/components/student/StudentDashboardView.tsx` - Dashboard do aluno
38. ⚠️ `src/components/student/StudentProgressView.tsx` - Progresso do aluno
39. ⚠️ `src/components/student/StudentProgressDashboard.tsx` - Dashboard de progresso
40. ⚠️ `src/components/student/StudentWorkoutsView.tsx` - Treinos do aluno
41. ⚠️ `src/components/student/StudentDietView.tsx` - Dieta do aluno
42. ⚠️ `src/components/student/StudentVideosView.tsx` - Vídeos do aluno
43. ⚠️ `src/components/student/StudentReportsView.tsx` - Relatórios do aluno
44. ⚠️ `src/components/student/StudentMessagesView.tsx` - Mensagens do aluno
45. ⚠️ `src/components/student/StudentChatView.tsx` - Chat do aluno
46. ⚠️ `src/components/student/StudentWeeklyCheckin.tsx` - Check-in semanal
47. ⚠️ `src/components/student/StudentProfileView.tsx` - Perfil do aluno
48. ⚠️ `src/components/student/StudentFinancialView.tsx` - Financeiro do aluno
49. ⚠️ `src/components/student/StudentFinancialManagement.tsx` - Gestão financeira
50. ⚠️ `src/components/student/StudentSidebar.tsx` - Barra lateral do aluno
51. ⚠️ `src/components/student/MessagesPopover.tsx` - Popover de mensagens

---

## 📝 SCRIPTS E UTILITÁRIOS

52. ⚠️ `src/scripts/import-taco-foods.ts` - Importação TACO
53. ⚠️ `src/scripts/import-alimentos.ts` - Importação de alimentos

---

## 🔧 ARQUIVOS DE INTEGRAÇÃO (Manter para Referência)

- `src/integrations/supabase/client.ts` - Cliente Supabase (pode ser removido após migração completa)
- `src/integrations/supabase/types.ts` - Tipos Supabase (pode ser removido após migração completa)

---

## 📊 ESTATÍSTICAS

- **Total de arquivos**: 52
- **Migrados**: 2 (VideoGallery, VideoForm)
- **Pendentes**: 50
- **Componentes principais**: 7
- **Componentes do aluno**: 15
- **Componentes de gestão**: 28

---

## 🚀 PLANO DE MIGRAÇÃO

### Fase 1: Componentes Críticos (Prioridade Alta)
1. Dashboard.tsx
2. StudentManager.tsx
3. WorkoutManager.tsx
4. NutritionManager.tsx
5. PaymentManager.tsx

### Fase 2: Funcionalidades Essenciais
6. FoodManager.tsx
7. DietCreator.tsx
8. ReportManager.tsx
9. MessageManager.tsx
10. AgendaManager.tsx

### Fase 3: Portal do Aluno
11-25. Todos os componentes em `src/components/student/`

### Fase 4: Componentes Secundários
26-50. Restantes

---

## ✅ PADRÃO DE MIGRAÇÃO

### Antes (Supabase):
```typescript
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .from('tabela')
  .select('*')
  .eq('campo', valor);

if (error) throw error;
```

### Depois (apiClient):
```typescript
import { apiClient } from "@/lib/api-client";

const data = await apiClient
  .from('tabela')
  .select('*')
  .eq('campo', valor);
```

### Autenticação:
```typescript
// Antes
const { data: { user } } = await supabase.auth.getUser();

// Depois
const { user } = useAuth();
```

### Storage:
```typescript
// Antes
await supabase.storage.from('bucket').upload('path', file);

// Depois
await apiClient.storage.upload('bucket', 'path', file);
```

---

**Última atualização**: 12 de Janeiro de 2026
