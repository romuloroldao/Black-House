# 🔄 Migração: Componentes Restantes

**Data**: 12 de Janeiro de 2026  
**Status**: 🟡 **EM PROGRESSO**

---

## ✅ COMPONENTES MIGRADOS HOJE

1. ✅ **WorkoutForm.tsx** - 0 referências ao Supabase
   - Migrado `supabase.auth.getUser()` → `useAuth()`
   - Migrado `supabase.from('treinos').insert/update()` → `apiClient`

2. ✅ **ExpenseManager.tsx** - 0 referências ao Supabase
   - Migrado todas as queries para `apiClient`
   - CRUD completo migrado

---

## 🟡 COMPONENTES AINDA PENDENTES

### Alta Prioridade (Muitas Referências)

1. 🟡 **StudentDetails.tsx** - ~15 referências
   - Múltiplas queries
   - Upload de arquivos
   - Auth.getUser()
   - Criar conversas
   - **Complexidade**: Alta

2. 🟡 **AnnouncementManager.tsx** - ~10 referências
   - Queries complexas com joins
   - Criar avisos e destinatários
   - **Complexidade**: Média

3. 🟡 **ReportForm.tsx** - ~9 referências
   - Upload de arquivos
   - Múltiplas queries e inserts
   - **Complexidade**: Média-Alta

4. 🟡 **ClassGroupManager.tsx** - ~9 referências
   - CRUD de turmas
   - Relacionamentos com alunos
   - **Complexidade**: Média

5. 🟡 **UserRolesManager.tsx** - ~8 referências
   - Múltiplas queries e updates
   - **Complexidade**: Média

6. 🟡 **UserLinkingManager.tsx** - ~5 referências
   - Queries simples
   - **Complexidade**: Baixa

---

## 📝 ESTRATÉGIA

### Próximos Passos

1. Migrar componentes de baixa complexidade primeiro
2. Depois migrar componentes médios
3. Por último, componentes de alta complexidade (StudentDetails.tsx)

---

**Última atualização**: 12 de Janeiro de 2026
