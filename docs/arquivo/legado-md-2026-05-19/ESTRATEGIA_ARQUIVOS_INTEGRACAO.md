# 📋 Estratégia: Arquivos de Integração Supabase

**Data**: 12 de Janeiro de 2026  
**Status**: 🟡 **DECISÃO NECESSÁRIA**

---

## 📁 ARQUIVOS ENVOLVIDOS

1. **`src/integrations/supabase/client.ts`**
   - Cliente Supabase (`createClient`)
   - URL e chaves hardcoded
   - Usado por ~13 componentes ainda em migração
   - Usado por 2 scripts de importação

2. **`src/integrations/supabase/types.ts`**
   - Tipos TypeScript do banco (1956 linhas)
   - Geração automática do Supabase
   - Pode ser útil para referência de tipos

---

## 🎯 OPÇÕES DISPONÍVEIS

### Opção A: Remover Completamente ✅

**Quando**: Após migração completa de todos os componentes

**Ações**:
- Remover `src/integrations/supabase/client.ts`
- Remover `src/integrations/supabase/types.ts`
- Remover `@supabase/supabase-js` do `package.json`
- Verificar se algum componente ainda importa
- Atualizar documentação

**Prós**:
- ✅ Limpeza completa
- ✅ Remove dependência externa
- ✅ Projeto 100% local

**Contras**:
- ❌ Scripts precisarão ser adaptados
- ❌ Perde tipos do banco (se úteis)

---

### Opção B: Manter Apenas para Scripts ⭐ **RECOMENDADO**

**Quando**: Agora (scripts não afetam app principal)

**Ações**:
- Manter `client.ts` e `types.ts` apenas para scripts
- Documentar que é apenas para scripts
- Adicionar aviso em `client.ts` sobre uso restrito
- Scripts continuam funcionando normalmente

**Prós**:
- ✅ Scripts funcionam sem mudanças
- ✅ Não afeta app principal
- ✅ Migração pode continuar

**Contras**:
- ⚠️ Mantém dependência do Supabase
- ⚠️ Scripts ainda dependem de Supabase

---

### Opção C: Adaptar para Nova Realidade 🔄

**Quando**: Se necessário manter compatibilidade

**Ações**:
- Adaptar `client.ts` para usar API local (se scripts precisarem)
- Criar endpoint especial no backend para importações
- Manter `types.ts` como referência (sem usar Supabase)

**Prós**:
- ✅ Scripts usam API local
- ✅ Remove dependência Supabase completamente

**Contras**:
- ❌ Requer trabalho adicional
- ❌ Precisa criar endpoints específicos

---

## 📊 ANÁLISE DE USO ATUAL

### Componentes (13 ainda usando):
- AnnouncementManager.tsx
- ClassGroupManager.tsx
- DietViewer.tsx
- FinancialExceptionsManager.tsx
- LiveManager.tsx
- NotificationsPopover.tsx
- PaymentStatusTracker.tsx
- RecurringChargesConfig.tsx
- ReportForm.tsx
- SearchDialog.tsx
- StudentDetails.tsx
- UserLinkingManager.tsx
- UserRolesManager.tsx

### Scripts (2 usando):
- `import-taco-foods.ts` - Importação de alimentos TACO
- `import-alimentos.ts` - Importação de alimentos CSV

### Páginas (2 usando - verificar):
- ReportViewPage.tsx
- StudentPortal.tsx

---

## 🎯 RECOMENDAÇÃO

### Fase 1: Imediato (Agora)
✅ **Manter arquivos apenas para scripts**
- Adicionar aviso em `client.ts` sobre uso restrito
- Documentar que scripts podem usar
- Continuar migração de componentes

### Fase 2: Após Migração de Componentes
🟡 **Decidir sobre scripts**
- Opção B: Manter Supabase para scripts
- Opção C: Migrar scripts para API local

### Fase 3: Limpeza Final (Opcional)
🟡 **Remover completamente**
- Se scripts foram migrados
- Remover `client.ts` e `types.ts`
- Remover dependência

---

## 📝 IMPLEMENTAÇÃO RECOMENDADA

### 1. Adicionar Aviso em `client.ts`

```typescript
/**
 * ⚠️ DEPRECADO - USO RESTRITO
 * 
 * Este arquivo está sendo mantido temporariamente apenas para:
 * - Scripts de importação (import-taco-foods.ts, import-alimentos.ts)
 * - Compatibilidade durante migração
 * 
 * **NÃO USE EM NOVOS COMPONENTES!**
 * 
 * Use `apiClient` de `@/lib/api-client` e `useAuth()` de `@/contexts/AuthContext`
 */
```

### 2. Manter `types.ts` como Referência

- Útil para conhecer estrutura do banco
- Pode ser usado como referência durante migração
- Não precisa ser removido imediatamente

### 3. Documentar Estratégia

- Criar `README.md` na pasta `integrations/supabase`
- Explicar status e estratégia
- Documentar quando será removido

---

## ✅ CONCLUSÃO

**Recomendação Final**: **Opção B** (Manter para scripts)

**Razão**:
- Scripts não fazem parte do app principal
- Não afeta produção
- Permite continuar migração sem bloquear
- Scripts podem ser migrados depois, se necessário

**Ação Imediata**:
1. Adicionar aviso em `client.ts`
2. Criar `README.md` explicando estratégia
3. Continuar migração de componentes
4. Decidir sobre scripts depois

---

**Última atualização**: 12 de Janeiro de 2026
