# Correção: Chat do Aluno com Coach

## Problema
Alunos não conseguiam enviar mensagens para o coach através do chat.

## Causa Raiz
O componente `StudentChatView` estava buscando o aluno por `email` ao invés de usar `linked_user_id`, que é o campo correto para vincular alunos aos usuários autenticados após a migração do Supabase.

## Correções Aplicadas

### 1. Busca do Aluno (`/root/src/components/student/StudentChatView.tsx`)

**Antes:**
```typescript
const alunos = await apiClient
  .from("alunos")
  .select("id, coach_id")
  .eq("email", user?.email);
```

**Depois:**
```typescript
// Buscar aluno pelo linked_user_id (campo correto)
let alunos = await apiClient
  .from("alunos")
  .select("id, coach_id, linked_user_id")
  .eq("linked_user_id", user.id);

// Fallback: buscar por email se linked_user_id não estiver preenchido
if (!aluno && user.email) {
  alunos = await apiClient
    .from("alunos")
    .select("id, coach_id, linked_user_id")
    .eq("email", user.email);
}
```

### 2. Atualização de Mensagens (marcar como lida)

**Antes:**
```typescript
await apiClient
  .from("mensagens")
  .update({ lida: true })
  .eq("id", msg.id);
```

**Depois:**
```typescript
// Usar PATCH direto na URL com id na query string
await apiClient.request(`/api/mensagens?id=${msg.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ lida: true }),
});
```

### 3. Atualização de Conversa

**Antes:**
```typescript
await apiClient
  .from("conversas")
  .update({
    ultima_mensagem: novaMensagem.trim(),
    ultima_mensagem_em: new Date().toISOString(),
  })
  .eq("id", conversaId);
```

**Depois:**
```typescript
await apiClient.request(`/api/conversas?id=${conversaId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    ultima_mensagem: novaMensagem.trim(),
    ultima_mensagem_em: new Date().toISOString(),
  }),
});
```

### 4. Tratamento de Erros

- Adicionado verificação de `user?.id` antes de fazer requisições
- Adicionado mensagens de erro mais descritivas via `toast.error()`
- Adicionado tratamento de casos onde aluno não tem coach vinculado

## Verificações Necessárias

### 1. Verificar se o aluno tem `linked_user_id` preenchido

Se o aluno não conseguir usar o chat, verificar se o campo `linked_user_id` está preenchido na tabela `alunos`:

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
WHERE email = 'email@do.aluno';
```

### 2. Verificar se existe conversa

Verificar se a conversa foi criada corretamente:

```sql
SELECT * FROM public.conversas 
WHERE aluno_id = 'id_do_aluno';
```

### 3. Verificar permissões nas rotas genéricas

As rotas genéricas `/api/:table` devem permitir acesso a `conversas` e `mensagens` para alunos. Verificar se o `domainSchemaGuard` está permitindo acesso correto.

## Funcionalidades do Chat

- ✅ Busca aluno por `linked_user_id` (com fallback para email)
- ✅ Cria conversa automaticamente se não existir
- ✅ Envia mensagens para o coach
- ✅ Marca mensagens como lidas
- ✅ Atualiza última mensagem da conversa
- ✅ Carrega mensagens automaticamente a cada 5 segundos (polling)
- ✅ Validação de permissões (aluno só vê sua própria conversa)

## Próximos Passos

1. Testar o chat com um aluno que tem `linked_user_id` preenchido
2. Se necessário, executar script para vincular alunos existentes aos usuários
3. Verificar logs do backend para identificar erros de permissão, se houver

## Arquivos Modificados

- `/root/src/components/student/StudentChatView.tsx`
