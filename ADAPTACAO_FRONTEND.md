# Guia de Adaptação do Frontend

Este guia mostra como adaptar o código do frontend para usar a nova API ao invés do Supabase.

## 1. Substituir Cliente Supabase

### Antes
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Depois
```typescript
import { apiClient } from './lib/api-client'
// Não precisa mais de URL e chave
```

## 2. Autenticação

### Sign Up

**Antes:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
})
```

**Depois:**
```typescript
try {
  const { user, token } = await apiClient.signUp(email, password)
  // Token é salvo automaticamente
} catch (error) {
  console.error(error.message)
}
```

### Sign In

**Antes:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

**Depois:**
```typescript
try {
  const { user, token } = await apiClient.signIn(email, password)
} catch (error) {
  console.error(error.message)
}
```

### Sign Out

**Antes:**
```typescript
await supabase.auth.signOut()
```

**Depois:**
```typescript
await apiClient.signOut()
```

### Obter Usuário Atual

**Antes:**
```typescript
const { data: { user } } = await supabase.auth.getUser()
```

**Depois:**
```typescript
try {
  const { user } = await apiClient.getUser()
} catch (error) {
  // Usuário não autenticado
}
```

### Listener de Mudanças de Auth

**Antes:**
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // ...
})
```

**Depois:**
```typescript
// Implementar manualmente verificando token
const checkAuth = async () => {
  const token = apiClient.getToken()
  if (token) {
    try {
      const { user } = await apiClient.getUser()
      // Usuário autenticado
    } catch {
      // Token inválido, fazer logout
      apiClient.signOut()
    }
  }
}
```

## 3. Queries de Banco de Dados

### Select

**Antes:**
```typescript
const { data, error } = await supabase
  .from('tabela')
  .select('*')
  .eq('campo', 'valor')
```

**Depois:**
```typescript
// O cliente básico não tem filtros avançados
// Você pode:
// 1. Usar RPC para queries complexas
// 2. Filtrar no frontend
// 3. Adicionar endpoints específicos na API

const data = await apiClient.from('tabela').select('*')
// Filtrar no frontend se necessário
const filtered = data.filter(item => item.campo === 'valor')
```

### Insert

**Antes:**
```typescript
const { data, error } = await supabase
  .from('tabela')
  .insert({ campo: 'valor' })
```

**Depois:**
```typescript
try {
  const data = await apiClient.from('tabela').insert({ campo: 'valor' })
} catch (error) {
  console.error(error.message)
}
```

### Update

**Antes:**
```typescript
const { data, error } = await supabase
  .from('tabela')
  .update({ campo: 'novo valor' })
  .eq('id', id)
```

**Depois:**
```typescript
try {
  const data = await apiClient.from('tabela').update({ 
    id,
    campo: 'novo valor' 
  })
} catch (error) {
  console.error(error.message)
}
```

### Delete

**Antes:**
```typescript
const { error } = await supabase
  .from('tabela')
  .delete()
  .eq('id', id)
```

**Depois:**
```typescript
try {
  await apiClient.from('tabela').delete(id)
} catch (error) {
  console.error(error.message)
}
```

## 4. RPC (Funções do Banco)

**Antes:**
```typescript
const { data, error } = await supabase.rpc('nome_funcao', { param: 'valor' })
```

**Depois:**
```typescript
try {
  const data = await apiClient.rpc('nome_funcao', { param: 'valor' })
} catch (error) {
  console.error(error.message)
}
```

## 5. Storage

### Upload

**Antes:**
```typescript
const { data, error } = await supabase.storage
  .from('bucket')
  .upload('path/to/file.jpg', file)
```

**Depois:**
```typescript
try {
  const { path } = await apiClient.uploadFile('bucket', 'path/to/file.jpg', file)
} catch (error) {
  console.error(error.message)
}
```

### Download/URL Pública

**Antes:**
```typescript
const { data } = supabase.storage
  .from('bucket')
  .getPublicUrl('path/to/file.jpg')
const url = data.publicUrl
```

**Depois:**
```typescript
const url = apiClient.getPublicUrl('bucket', 'path/to/file.jpg')
```

### Delete

**Antes:**
```typescript
await supabase.storage
  .from('bucket')
  .remove(['path/to/file.jpg'])
```

**Depois:**
```typescript
// Adicionar método delete no apiClient ou criar endpoint específico
// Por enquanto, você precisaria adicionar isso na API
```

## 6. Realtime (Substituições)

O Supabase Realtime não está disponível na API básica. Opções:

1. **Polling**: Verificar mudanças periodicamente
2. **WebSocket próprio**: Implementar WebSocket na API
3. **Server-Sent Events**: Usar SSE para updates em tempo real

Exemplo de polling:
```typescript
const pollData = async () => {
  const data = await apiClient.from('tabela').select('*')
  // Atualizar estado
}

setInterval(pollData, 5000) // A cada 5 segundos
```

## 7. Row Level Security (RLS)

O RLS do Supabase precisa ser implementado na API. A API atual verifica autenticação, mas não implementa RLS automático.

**Solução**: Adicionar validações nos endpoints da API ou criar middlewares específicos.

## 8. Exemplo Completo de Componente

### Antes (com Supabase)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

async function loadData() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
  
  if (error) throw error
  return data
}
```

### Depois (com API própria)
```typescript
import { apiClient } from './lib/api-client'

async function loadData() {
  try {
    const allData = await apiClient.from('exercises').select('*')
    // Filtrar por user_id no frontend ou criar endpoint específico
    return allData.filter(item => item.user_id === userId)
  } catch (error) {
    throw error
  }
}
```

## 9. Variáveis de Ambiente

### Antes
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Depois
```env
VITE_API_URL=https://api.seudominio.com
```

## 10. Remover Dependências

```bash
npm uninstall @supabase/supabase-js
```

## Checklist de Migração

- [ ] Substituir todas as importações do Supabase
- [ ] Atualizar chamadas de autenticação
- [ ] Adaptar queries de banco de dados
- [ ] Adaptar operações de storage
- [ ] Implementar substituição para Realtime (se necessário)
- [ ] Atualizar variáveis de ambiente
- [ ] Remover dependência do Supabase
- [ ] Testar todas as funcionalidades
- [ ] Verificar tratamento de erros
