# DESIGN-ALUNO-CANONICO-UNIFICADO-005 - IMPLEMENTADO

**Version:** 1.0.0  
**Status:** ✅ IMPLEMENTED  
**Objective:** Unificar o conceito de aluno canônico em toda a aplicação

## Objetivo

Garantir que o aluno canônico seja sempre resolvido de forma unificada via `GET /api/alunos/me`, eliminando inferências implícitas e buscas por email.

## Fonte Única de Verdade

- **Rota:** `GET /api/alunos/me`
- **Resolver:** `resolveAlunoOrFail` (backend)
- **Frontend:** `apiClient.getMe()`

## Implementações

### 1. Utilitário `aluno-utils.ts` Deprecated

**Arquivo:** `/root/src/lib/aluno-utils.ts`

- ✅ Função `getAlunoByUser()` agora usa `apiClient.getMe()`
- ✅ Removida lógica de busca por `linked_user_id` e fallback por email
- ✅ Marcada como `@deprecated` com orientação para usar `apiClient.getMe()` diretamente

### 2. Componentes de Aluno Migrados

#### ✅ StudentProfileView.tsx
- ✅ Removida busca por email: `.from("alunos").select("*").eq("email", user?.email)`
- ✅ Substituída por: `apiClient.getMe()`

#### ✅ StudentSidebar.tsx
- ✅ `loadStudentProfile()`: Usa `apiClient.getMe()`
- ✅ `loadUnreadCount()`: Usa `apiClient.getMe()`
- ✅ `markAnnouncementsAsRead()`: Usa `apiClient.getMe()` (parcialmente - ainda usa `.from()` para outras entidades)

#### ✅ StudentChatView.tsx
- ✅ Já usa `apiClient.getMe()`

#### ✅ StudentWeeklyCheckin.tsx
- ✅ Já usa `/api/checkins` que resolve aluno automaticamente

### 3. Componentes Não Críticos Migrados (DESIGN-006)

Todos os componentes não críticos foram migrados no DESIGN-ALUNO-CANONICO-MIGRATION-006:

- ✅ `StudentVideosView.tsx` - Migrado
- ✅ `StudentProgressView.tsx` - Migrado
- ✅ `StudentReportsView.tsx` - Migrado
- ✅ `StudentMessagesView.tsx` - Migrado
- ✅ `StudentDietView.tsx` - Migrado
- ✅ `StudentDashboardView.tsx` - Migrado
- ✅ `StudentFinancialView.tsx` - Migrado
- ✅ `StudentWorkoutsView.tsx` - Migrado
- ✅ `StudentProgressDashboard.tsx` - Migrado

**Ver:** `DESIGN-ALUNO-CANONICO-MIGRATION-006-IMPLEMENTADO.md`

## Regras do Frontend

### ✅ Forbidden (Implementado)

- ✅ Não armazenar `aluno_id` manualmente em estado
- ✅ Não inferir aluno de `user_id` no frontend
- ✅ Não passar `aluno_id` em requests (exceto para entidades relacionadas como dietas, treinos, etc.)

### ✅ Mandatory (Implementado)

- ✅ Buscar aluno apenas via `apiClient.getMe()` (que chama `GET /api/alunos/me`)

## Regras do Backend

### ✅ Implementado

- ✅ Aluno sempre resolvido via `resolveAlunoOrFail` middleware
- ✅ `alunos.user_id` é UNIQUE no banco
- ✅ Rotas protegidas com `validateRole(['aluno'])` + `resolveAlunoOrFail`

## Padrão de Uso

### ✅ Correto

```typescript
// Buscar aluno canônico
const aluno = await apiClient.getMe();

// Usar aluno.id para entidades relacionadas (OK)
await apiClient.request('/api/dietas', {
  method: 'POST',
  body: JSON.stringify({
    aluno_id: aluno.id, // OK: Para relacionar dieta ao aluno
    // ...
  })
});
```

### ❌ Incorreto

```typescript
// ❌ NÃO fazer: Buscar por email
const alunos = await apiClient
  .from("alunos")
  .select("*")
  .eq("email", user.email);

// ❌ NÃO fazer: Inferir de user_id
const aluno = await getAlunoByUser(user.id, user.email);

// ❌ NÃO fazer: Passar aluno_id para identificar o próprio aluno
await apiClient.request('/api/checkins', {
  body: JSON.stringify({
    aluno_id: aluno.id // ❌ Backend resolve automaticamente
  })
});
```

## Critérios de Aceitação

### ✅ Todos Atendidos

- ✅ Componentes críticos (Profile, Sidebar, Chat, Check-in) não assumem aluno implicitamente
- ✅ Aluno sempre resolvido de forma canônica em todos os componentes
- ✅ Todos os componentes não críticos migrados (DESIGN-006)
- ✅ Nenhuma busca por email
- ✅ Nenhuma inferência implícita

## Status Final

**✅ IMPLEMENTED**

### ✅ Componentes Críticos Migrados
- `StudentProfileView.tsx`
- `StudentSidebar.tsx`
- `StudentChatView.tsx`
- `StudentWeeklyCheckin.tsx`
- `aluno-utils.ts` (deprecated)

### ✅ Componentes Não Críticos Migrados (DESIGN-006)
- `StudentVideosView.tsx`
- `StudentProgressView.tsx`
- `StudentReportsView.tsx`
- `StudentMessagesView.tsx`
- `StudentDietView.tsx`
- `StudentDashboardView.tsx`
- `StudentFinancialView.tsx`
- `StudentWorkoutsView.tsx`
- `StudentProgressDashboard.tsx`

### ✅ Backend
- ✅ `resolveAlunoOrFail` sempre usado
- ✅ `alunos.user_id` UNIQUE
- ✅ Rotas protegidas com `validateRole(['aluno'])`

## Próximos Passos

1. ✅ Migração completa realizada (DESIGN-006)
2. ⚠️ Opcional: Remover `aluno-utils.ts` completamente (não crítico, já está deprecated)
3. ✅ Todos os componentes usam `apiClient.getMe()` como única fonte de verdade
