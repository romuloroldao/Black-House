# DESIGN-ALUNO-CANONICO-MIGRATION-006 - IMPLEMENTADO

**Version:** 1.0.0  
**Status:** ✅ IMPLEMENTED  
**Objective:** Completar a migração do aluno canônico em componentes não críticos de forma incremental e segura

## Objetivo

Migrar todos os componentes não críticos de aluno para usar `apiClient.getMe()` como única fonte de verdade, eliminando completamente buscas por email e inferências implícitas.

## Componentes Migrados

### ✅ Todos os Componentes Migrados

1. **StudentVideosView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("coach_id").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

2. **StudentProgressView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("id").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

3. **StudentReportsView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("id").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

4. **StudentMessagesView.tsx**
   - ✅ Removida busca por email em `loadCoachName()`: `.from("alunos").select("coach_id").eq("email", user.email)`
   - ✅ Removida busca por email em `loadAvisos()`: `.from("alunos").select("id").eq("email", user.email)`
   - ✅ Substituídas por: `apiClient.getMe()`

5. **StudentDietView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("id").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

6. **StudentDashboardView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("*").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

7. **StudentFinancialView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("*").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

8. **StudentWorkoutsView.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("id, nome").eq("email", user?.email)`
   - ✅ Substituída por: `apiClient.getMe()`

9. **StudentProgressDashboard.tsx**
   - ✅ Removida busca por email: `.from("alunos").select("id").eq("email", user.email)`
   - ✅ Substituída por: `apiClient.getMe()`

## Verificações Realizadas

### ✅ Nenhum Import de `aluno-utils.ts`
- ✅ Verificado: Nenhum componente importa `aluno-utils.ts`
- ✅ Verificado: Nenhum componente usa `getAlunoByUser()`

### ✅ Nenhuma Busca por Email
- ✅ Verificado: Nenhum componente busca aluno por email
- ✅ Verificado: Nenhum componente usa `.eq("email", ...)` para buscar aluno

### ✅ Build Validado
- ✅ Build passa sem erros
- ✅ Apenas warnings de chunk size (não relacionados)

## Padrão Estabelecido

### ✅ Correto (Todos os Componentes)

```typescript
// DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
const aluno = await apiClient.getMe();

if (aluno) {
  // Usar aluno.id, aluno.coach_id, etc.
}
```

### ❌ Incorreto (Removido)

```typescript
// ❌ REMOVIDO: Buscar por email
const alunos = await apiClient
  .from("alunos")
  .select("id")
  .eq("email", user?.email);

// ❌ REMOVIDO: Inferir de user_id
const aluno = await getAlunoByUser(user.id, user.email);
```

## Regras Implementadas

### ✅ Mandatory (100% Implementado)

- ✅ Todos os componentes usam exclusivamente `apiClient.getMe()`
- ✅ Removida qualquer inferência por email
- ✅ Nenhum componente importa `aluno-utils.ts`

### ✅ Forbidden (100% Eliminado)

- ✅ `getAlunoByUser` não é mais usado
- ✅ Lookup por `user_id` não é mais usado
- ✅ Fallbacks implícitos não são mais usados

## Deprecation Policy

### `aluno-utils.ts`

**Status:** DEPRECATED ✅  
**Allowed Until:** Após migração completa ✅  
**Final Action:** Pode ser deletado (mas mantido por compatibilidade)

**Nota:** O arquivo `aluno-utils.ts` ainda existe mas agora apenas delega para `apiClient.getMe()`. Pode ser removido completamente em uma limpeza futura.

## Critérios de Aceitação

### ✅ Todos Atendidos

- ✅ Nenhum componente importa `aluno-utils.ts`
- ✅ Todas as telas usam `apiClient.getMe()`
- ✅ Nenhuma suposição implícita de aluno
- ✅ DESIGN-005 pode ser marcado como IMPLEMENTED

## Status Final

**✅ IMPLEMENTED**

### Componentes Críticos (DESIGN-005)
- ✅ `StudentProfileView.tsx`
- ✅ `StudentSidebar.tsx`
- ✅ `StudentChatView.tsx`
- ✅ `StudentWeeklyCheckin.tsx`

### Componentes Não Críticos (DESIGN-006)
- ✅ `StudentVideosView.tsx`
- ✅ `StudentProgressView.tsx`
- ✅ `StudentReportsView.tsx`
- ✅ `StudentMessagesView.tsx`
- ✅ `StudentDietView.tsx`
- ✅ `StudentDashboardView.tsx`
- ✅ `StudentFinancialView.tsx`
- ✅ `StudentWorkoutsView.tsx`
- ✅ `StudentProgressDashboard.tsx`

### Backend
- ✅ `resolveAlunoOrFail` sempre usado
- ✅ `alunos.user_id` UNIQUE
- ✅ Rotas protegidas com `validateRole(['aluno'])`

## Próximos Passos

1. ✅ Migração completa realizada
2. ⚠️ Opcional: Remover `aluno-utils.ts` completamente (não crítico)
3. ✅ DESIGN-005 pode ser atualizado para status IMPLEMENTED

## Conclusão

A migração foi concluída com sucesso. Todos os componentes de aluno agora usam `apiClient.getMe()` como única fonte de verdade, eliminando completamente buscas por email e inferências implícitas. O sistema está unificado e pronto para produção.
