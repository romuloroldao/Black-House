# Correção: Check-in Semanal - Aluno não encontrado

## Problema
Alunos não conseguiam enviar check-in semanal devido ao erro "Aluno não encontrado".

## Causa Raiz
Após a migração do Supabase para VPS, todos os componentes que buscam aluno por `email` precisam usar `linked_user_id` ao invés. O componente `StudentWeeklyCheckin` estava usando o método antigo.

## Correções Aplicadas

### 1. Função Utilitária (`/root/src/lib/aluno-utils.ts`)

Criada função centralizada para buscar aluno:

```typescript
export async function getAlunoByUser(userId: string, userEmail?: string)
```

- Busca primeiro por `linked_user_id` (método correto)
- Faz fallback para `email` se `linked_user_id` não estiver preenchido
- Centraliza a lógica para evitar duplicação

### 2. Atualização do Componente (`/root/src/components/student/StudentWeeklyCheckin.tsx`)

**Antes:**
```typescript
const alunos = await apiClient
  .from("alunos")
  .select("id")
  .eq("email", user.email);
```

**Depois:**
```typescript
import { getAlunoByUser } from "@/lib/aluno-utils";

const aluno = await getAlunoByUser(user.id, user.email);
```

## Componentes que Ainda Precisam de Correção

Os seguintes componentes ainda buscam aluno por email e devem ser atualizados:

- `/src/components/student/StudentVideosView.tsx`
- `/src/components/student/MessagesPopover.tsx`
- `/src/components/student/StudentFinancialView.tsx`
- `/src/components/student/StudentSidebar.tsx`
- `/src/components/student/StudentProgressView.tsx`
- `/src/components/student/StudentProgressDashboard.tsx`
- `/src/components/student/StudentMessagesView.tsx`
- `/src/components/student/StudentReportsView.tsx`
- `/src/components/student/StudentProfileView.tsx`
- `/src/components/student/StudentWorkoutsView.tsx`
- `/src/components/student/StudentDietView.tsx`
- `/src/components/student/StudentDashboardView.tsx`

## Como Corrigir os Demais Componentes

Para corrigir qualquer componente que busca aluno por email, substitua:

```typescript
// ANTES
const alunos = await apiClient
  .from("alunos")
  .select("id, coach_id")
  .eq("email", user.email);
const aluno = Array.isArray(alunos) && alunos.length > 0 ? alunos[0] : null;

// DEPOIS
import { getAlunoByUser } from "@/lib/aluno-utils";

const aluno = await getAlunoByUser(user.id, user.email);
```

## Verificações Necessárias

### 1. Verificar se o aluno tem `linked_user_id` preenchido

```sql
SELECT id, nome, email, linked_user_id, coach_id 
FROM public.alunos 
WHERE email = 'email@do.aluno';
```

Se `linked_user_id` estiver NULL, vincular manualmente:

```sql
UPDATE public.alunos 
SET linked_user_id = (
  SELECT id FROM app_auth.users WHERE email = 'email@do.aluno'
)
WHERE email = 'email@do.aluno' AND linked_user_id IS NULL;
```

### 2. Script para Vincular Todos os Alunos

Se muitos alunos estiverem sem `linked_user_id`, execute:

```sql
-- Vincular alunos que têm email correspondente em app_auth.users
UPDATE public.alunos a
SET linked_user_id = u.id
FROM app_auth.users u
WHERE a.email IS NOT NULL 
  AND a.email != ''
  AND a.email = u.email
  AND a.linked_user_id IS NULL;
```

## Arquivos Modificados

- ✅ `/root/src/lib/aluno-utils.ts` - Novo arquivo com função utilitária
- ✅ `/root/src/components/student/StudentWeeklyCheckin.tsx` - Atualizado para usar linked_user_id
- ✅ `/root/src/components/student/StudentChatView.tsx` - Já corrigido anteriormente

## Status

✅ **Check-in Semanal**: Corrigido
✅ **Chat com Coach**: Corrigido
⚠️ **Outros componentes**: Ainda precisam ser atualizados (usar `getAlunoByUser()`)
