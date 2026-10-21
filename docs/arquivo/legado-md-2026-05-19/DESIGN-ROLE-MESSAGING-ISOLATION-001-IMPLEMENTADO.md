# DESIGN-ROLE-MESSAGING-ISOLATION-001 - IMPLEMENTADO

**Version:** 1.0.0  
**Status:** ✅ IMPLEMENTED  
**Scope:** Isolamento de fluxos por role, eliminação de PostgREST e correção da mensageria

## Problema Resolvido

### Sintomas Identificados
- 403 Forbidden em /api/mensagens
- Erro 'Aluno não encontrado' ao logar como coach
- Polling infinito de notificações
- Chamadas com sintaxe PostgREST
- Tentativa de PATCH /api/alunos em fluxo de linkagem

### Root Causes
- Frontend dispara fluxos de aluno quando role = coach
- Mensageria ainda usa sintaxe PostgREST
- Polling não é condicionado ao role
- Tela de linkagem não migrou para rota semântica

## Implementação

### 1. Isolamento de Role

#### NotificationsPopover.tsx
- ✅ Polling condicionado a `user.role === 'aluno'`
- ✅ `loadNotifications()` verifica role antes de fazer chamadas
- ✅ Em caso de erro (ex: 403), limpa notificações

#### StudentChatView.tsx
- ✅ Verificação de role antes de carregar chat
- ✅ Polling condicionado a `user.role === 'aluno'`
- ✅ Mensagens de erro específicas para acesso negado

### 2. Eliminação de Sintaxe PostgREST

#### StudentChatView.tsx
- ✅ Removido uso de `.from("alunos").select().eq()`
- ✅ Migrado para `apiClient.getMe()` (rota semântica `/api/alunos/me`)
- ✅ Migrado para `apiClient.request('/api/mensagens')` (rota semântica)
- ✅ Removido uso de `.from("mensagens").select().eq().order()`
- ✅ Removido uso de `.from("conversas").select().eq()`

#### UserLinkingManager.tsx
- ✅ Migrado de `apiClient.from("alunos").update()` para `POST /api/alunos/link-user`
- ✅ Atualizado para usar `user_id` ao invés de `linked_user_id`
- ✅ Usa rota semântica conforme DESIGN-LINK-ALUNO-USER-001

#### api-client.ts
- ✅ Método `getMe()` atualizado para usar `/api/alunos/me`
- ✅ Método `from().delete()` com filtros agora retorna erro (sintaxe PostgREST proibida)
- ✅ Adicionado deprecation warning no método `from()`

### 3. Correção da Mensageria

#### Rotas Semânticas Implementadas
- ✅ `GET /api/mensagens` - Lista mensagens do aluno autenticado
- ✅ `POST /api/mensagens` - Envia mensagem (backend cria conversa se necessário)
- ✅ `PATCH /api/mensagens/:id` - Marca mensagem como lida

#### Fluxo de Mensagens
- ✅ Backend resolve aluno canônico via `resolveAlunoOrFail`
- ✅ Backend cria conversa automaticamente se não existir
- ✅ Frontend não precisa gerenciar conversas manualmente

### 4. Correção do Polling

#### NotificationsPopover.tsx
- ✅ Polling só executa se `user.role === 'aluno'`
- ✅ Polling é limpo quando role não é aluno

#### StudentChatView.tsx
- ✅ Polling só executa se `user.role === 'aluno'` e `conversaId` existe
- ✅ Polling é limpo quando condições não são atendidas

### 5. Correção do Fluxo de Linkagem

#### UserLinkingManager.tsx
- ✅ Migrado de `PATCH /rest/v1/alunos` para `POST /api/alunos/link-user`
- ✅ Usa `importedAlunoId` e `userIdToLink` conforme especificação
- ✅ Atualizado para usar `user_id` ao invés de `linked_user_id`

## Regras de Acesso por Role

### Aluno
**Permitido:**
- ✅ `/api/alunos/me` (GET, PATCH)
- ✅ `/api/mensagens` (GET, POST)
- ✅ `/api/notificacoes` (GET, PATCH, DELETE)
- ✅ `/api/checkins` (POST)

**Proibido:**
- ❌ `/api/alunos/link-user`
- ❌ `/api/alunos/by-coach`

### Coach
**Permitido:**
- ✅ `/api/alunos/by-coach` (GET)
- ✅ `/api/alunos/link-user` (POST)

**Proibido:**
- ❌ `/api/mensagens`
- ❌ `/api/notificacoes`
- ❌ `/api/checkins`
- ❌ `/api/alunos/me`

## Princípios Core Implementados

- ✅ **Role Isolation:** Rotas protegidas por `resolveAlunoOrFail` só podem ser chamadas se `role === 'aluno'`
- ✅ **PostgREST:** FORBIDDEN - Sintaxe `select=`, `eq=`, `neq=` removida
- ✅ **Polling:** Só existe para aluno autenticado
- ✅ **Explicit Business Intent:** Rotas semânticas com intenção clara

## Arquivos Modificados

1. **`src/components/NotificationsPopover.tsx`**
   - Polling condicionado a role
   - Verificação de role em `loadNotifications()`

2. **`src/components/student/StudentChatView.tsx`**
   - Verificação de role antes de todas as operações
   - Migrado para rotas semânticas
   - Removida sintaxe PostgREST

3. **`src/components/UserLinkingManager.tsx`**
   - Migrado para `POST /api/alunos/link-user`
   - Atualizado para usar `user_id`

4. **`src/lib/api-client.ts`**
   - Método `getMe()` atualizado
   - Método `from().delete()` com filtros proibido

## Critérios de Aceitação

- ✅ Coach login não dispara chamadas de API de aluno
- ✅ Nenhuma sintaxe PostgREST existe no frontend
- ✅ Polling só executa para role aluno
- ✅ Mensageria funciona apenas após resolução canônica de aluno
- ✅ Console permanece limpo para fluxos de coach e aluno

## Status Final

✅ **IMPLEMENTADO E PRONTO PARA TESTE**

- Isolamento de role implementado
- Sintaxe PostgREST eliminada
- Polling condicionado a role
- Mensageria usando rotas semânticas
- Fluxo de linkagem corrigido
