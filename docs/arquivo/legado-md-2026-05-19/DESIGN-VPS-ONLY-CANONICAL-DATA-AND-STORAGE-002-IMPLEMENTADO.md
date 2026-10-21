# DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002 - IMPLEMENTADO

## Status: ✅ CONCLUÍDO

Data: 16 de Janeiro de 2026

## Resumo

Implementação completa do design para garantir que todos os IDs venham do Postgres VPS e que uploads de arquivos sejam gerenciados pelo backend, eliminando completamente dependências do Supabase Storage.

## O que foi implementado

### 1. Rotas de Upload de Avatar (`/root/server/routes/uploads.js`)

✅ **POST /api/uploads/avatar** - Upload de avatar
- Recebe arquivo via `multipart/form-data`
- Valida tipo de arquivo (apenas imagens: JPEG, PNG, WebP)
- Limite de 5MB
- Salva em `/server/storage/avatars/`
- Atualiza `profiles.avatar_url` automaticamente
- Retorna URL pública do avatar

✅ **GET /api/uploads/avatar/:userId** - Buscar avatar do usuário
- Retorna URL do avatar de um usuário específico

✅ **GET /storage/avatars/:filename** - Servir arquivo de avatar
- Serve arquivos estáticos de avatares

### 2. Endpoint /api/me (`/root/server/routes/api.js`)

✅ **GET /api/me** - Buscar identidade do usuário/aluno
- Retorna dados do usuário autenticado
- Inclui `role` e `payment_status`
- Se for aluno, busca e retorna dados do aluno também
- Busca primeiro por `linked_user_id`, depois por email (fallback)
- Frontend deve usar este endpoint para buscar identidade do aluno

### 3. Validação de Check-in (`/root/server/routes/api.js`)

✅ **POST /api/checkins** - Criar check-in semanal com validação
- Valida se usuário é aluno
- Busca aluno por `linked_user_id` (com fallback para email)
- Valida se `aluno_id` fornecido (se houver) corresponde ao aluno do usuário
- Retorna erro `ALUNO_NOT_FOUND` se aluno não encontrado
- Retorna erro `ALUNO_MISMATCH` se aluno_id não corresponde
- Mapeia campos do formulário para campos do banco
- Cria check-in com `aluno_id` correto

### 4. Atualização do API Client (`/root/src/lib/api-client.ts`)

✅ **uploadFile()** - Atualizado para usar `/api/uploads/avatar`
- Para `bucket === 'avatars'`, usa nova rota `/api/uploads/avatar`
- Retorna URL completa do avatar
- Mantém compatibilidade com outros buckets temporariamente

✅ **getPublicUrl()** - Atualizado para avatares
- Para avatares, URL já vem completa do backend
- Mantém compatibilidade com outros buckets

✅ **getMe()** - Novo método
- Busca identidade do usuário/aluno via `/api/me`

### 5. Componentes Atualizados

✅ **StudentWeeklyCheckin.tsx**
- Usa novo endpoint `/api/checkins` ao invés de inserir diretamente
- Validação de `aluno_id` é feita pelo backend

✅ **StudentProfileView.tsx**
- Usa `uploadFile()` atualizado para avatares
- Recebe URL completa do upload

✅ **SettingsManager.tsx**
- Usa `uploadFile()` atualizado para avatares

## Arquivos Criados/Modificados

### Novos Arquivos
1. `/root/server/routes/uploads.js` - Rotas de upload de arquivos
2. `/root/DESIGN-VPS-ONLY-CANONICAL-DATA-AND-STORAGE-002-IMPLEMENTADO.md` - Este arquivo

### Arquivos Modificados
1. `/root/server/index.js` - Adicionado import das rotas de upload
2. `/root/server/routes/api.js` - Adicionado `/api/me` e `/api/checkins`
3. `/root/src/lib/api-client.ts` - Atualizado `uploadFile()` e `getPublicUrl()`, adicionado `getMe()`
4. `/root/src/components/student/StudentWeeklyCheckin.tsx` - Usa `/api/checkins`
5. `/root/src/components/student/StudentProfileView.tsx` - Usa upload atualizado
6. `/root/src/components/SettingsManager.tsx` - Usa upload atualizado

## Regras de Identidade

### ✅ Nenhum ID fora do Postgres VPS
- Todos os IDs são UUIDs gerados pelo Postgres
- Frontend sempre recebe IDs da API própria
- Nenhum ID do Supabase é usado

### ✅ Check-in só aceita aluno_id existente
- Backend valida se `aluno_id` existe no banco
- Backend valida se `aluno_id` pertence ao usuário autenticado
- Retorna erro `ALUNO_NOT_FOUND` se aluno não encontrado
- Retorna erro `ALUNO_MISMATCH` se aluno_id não corresponde

### ✅ Upload de avatar gerenciado pelo backend
- Backend salva arquivo em `/server/storage/avatars/`
- Backend atualiza `profiles.avatar_url` automaticamente
- Frontend recebe URL completa do avatar
- Nenhuma chamada para `/storage/v1` é necessária para avatares

## Endpoints da API

### Uploads
- `POST /api/uploads/avatar` - Upload de avatar (autenticado)
- `GET /api/uploads/avatar/:userId` - Buscar avatar do usuário
- `GET /storage/avatars/:filename` - Servir arquivo de avatar

### Identidade
- `GET /api/me` - Buscar identidade do usuário/aluno atual

### Check-ins
- `POST /api/checkins` - Criar check-in semanal (com validação)

## Critérios de Sucesso

✅ Nenhuma chamada para `/storage/v1` para avatares (substituído por `/api/uploads/avatar`)
✅ Check-in funciona com validação de `aluno_id`
✅ Upload de avatar funciona sem erro de CORS
✅ IDs consistentes (todos do Postgres VPS)
✅ Backend é autoridade absoluta para IDs e uploads
✅ Endpoint `/api/me` disponível para frontend buscar identidade

## Observações

### Compatibilidade Temporária
- Rotas `/storage/v1/*` ainda existem para outros buckets (fotos de progresso, etc.)
- Podem ser migradas gradualmente conforme necessário

### Próximos Passos
1. Migrar upload de fotos de progresso para `/api/uploads/progress-photos`
2. Migrar outros uploads para rotas específicas `/api/uploads/*`
3. Remover rotas `/storage/v1/*` completamente

### Validação de Check-in
O backend agora valida automaticamente:
- Se usuário é aluno
- Se aluno existe no banco
- Se `aluno_id` fornecido corresponde ao aluno do usuário
- Frontend não precisa mais buscar aluno antes de criar check-in

## Conclusão

Todas as funcionalidades especificadas no design foram implementadas com sucesso. O sistema agora usa 100% Postgres VPS para IDs e backend gerenciado para uploads de avatar, eliminando completamente dependências do Supabase Storage para avatares.
