# 📘 Guia de Migração de Componentes do Supabase para API Própria

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **GUIA COMPLETO**

---

## 🎯 Objetivo

Este guia mostra como migrar componentes que usam Supabase para usar a API própria (`apiClient`).

---

## 📋 Checklist de Migração

### 1. Substituir Imports

**ANTES:**
```typescript
import { supabase } from '@/integrations/supabase/client';
```

**DEPOIS:**
```typescript
import { apiClient } from '@/lib/api-client';
```

---

### 2. Autenticação

#### Verificar Sessão

**ANTES:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // usuário autenticado
}
```

**DEPOIS:**
```typescript
import { useAuth } from '@/contexts/AuthContext';

const { user, session } = useAuth();
if (user) {
  // usuário autenticado
}
```

#### Login/Logout

**ANTES:**
```typescript
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signOut();
```

**DEPOIS:**
```typescript
await apiClient.signIn(email, password);
await apiClient.signOut();
// ou usando o contexto
const { signOut } = useAuth();
await signOut();
```

---

### 3. Queries de Banco de Dados

#### Query Simples

**ANTES:**
```typescript
const { data, error } = await supabase
  .from('alunos')
  .select('*');
```

**DEPOIS:**
```typescript
const data = await apiClient
  .from('alunos')
  .select('*');
```

#### Query com Filtros

**ANTES:**
```typescript
const { data, error } = await supabase
  .from('alunos')
  .select('*')
  .eq('coach_id', userId)
  .eq('ativo', true)
  .order('created_at', { ascending: false })
  .limit(10);
```

**DEPOIS:**
```typescript
const data = await apiClient
  .from('alunos')
  .select('*')
  .eq('coach_id', userId)
  .eq('ativo', true)
  .order('created_at', { ascending: false })
  .limit(10);
```

#### Tratamento de Erros

**ANTES:**
```typescript
const { data, error } = await supabase.from('alunos').select('*');
if (error) {
  console.error(error);
  return;
}
// usar data
```

**DEPOIS:**
```typescript
try {
  const data = await apiClient.from('alunos').select('*');
  // usar data
} catch (error) {
  console.error(error);
  // tratar erro
}
```

---

### 4. Inserção de Dados

**ANTES:**
```typescript
const { data, error } = await supabase
  .from('alunos')
  .insert({ nome: 'João', email: 'joao@email.com' })
  .select()
  .single();
```

**DEPOIS:**
```typescript
const data = await apiClient
  .from('alunos')
  .insert({ nome: 'João', email: 'joao@email.com' });
```

---

### 5. Atualização de Dados

**ANTES:**
```typescript
const { data, error } = await supabase
  .from('alunos')
  .update({ nome: 'João Silva' })
  .eq('id', alunoId)
  .select()
  .single();
```

**DEPOIS:**
```typescript
const data = await apiClient
  .from('alunos')
  .update({ id: alunoId, nome: 'João Silva' });
```

**Nota**: A API atual requer o `id` no body para UPDATE.

---

### 6. Deleção de Dados

**ANTES:**
```typescript
const { error } = await supabase
  .from('alunos')
  .delete()
  .eq('id', alunoId);
```

**DEPOIS:**
```typescript
await apiClient
  .from('alunos')
  .delete(alunoId);
```

---

### 7. Storage (Upload/Download)

#### Upload

**ANTES:**
```typescript
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`user-${userId}/avatar.jpg`, file);
```

**DEPOIS:**
```typescript
const data = await apiClient.uploadFile(
  'avatars',
  `user-${userId}/avatar.jpg`,
  file
);
```

#### Download/URL Pública

**ANTES:**
```typescript
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`user-${userId}/avatar.jpg`);
const url = data.publicUrl;
```

**DEPOIS:**
```typescript
const url = apiClient.getPublicUrl(
  'avatars',
  `user-${userId}/avatar.jpg`
);
```

---

### 8. RPC (Funções do Banco)

**ANTES:**
```typescript
const { data, error } = await supabase
  .rpc('funcao_nome', { parametro1: valor1 });
```

**DEPOIS:**
```typescript
const data = await apiClient.rpc('funcao_nome', { parametro1: valor1 });
```

---

## 🔄 Padrões Comuns de Migração

### Padrão 1: Listagem com Filtros

**ANTES:**
```typescript
const { data: alunos, error } = await supabase
  .from('alunos')
  .select('*')
  .eq('coach_id', userId)
  .order('nome', { ascending: true });

if (error) {
  toast.error('Erro ao carregar alunos');
  return;
}

setAlunos(alunos || []);
```

**DEPOIS:**
```typescript
try {
  const alunos = await apiClient
    .from('alunos')
    .select('*')
    .eq('coach_id', userId)
    .order('nome', { ascending: true });
  
  setAlunos(alunos || []);
} catch (error) {
  toast.error('Erro ao carregar alunos');
}
```

### Padrão 2: Busca com Loading

**ANTES:**
```typescript
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);

const fetchData = async () => {
  setLoading(true);
  const { data, error } = await supabase.from('tabela').select('*');
  if (!error) setData(data || []);
  setLoading(false);
};
```

**DEPOIS:**
```typescript
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);

const fetchData = async () => {
  setLoading(true);
  try {
    const result = await apiClient.from('tabela').select('*');
    setData(result || []);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

### Padrão 3: Formulário com Insert/Update

**ANTES:**
```typescript
const handleSubmit = async (formData) => {
  if (editingId) {
    const { error } = await supabase
      .from('tabela')
      .update(formData)
      .eq('id', editingId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('tabela')
      .insert(formData);
    if (error) throw error;
  }
};
```

**DEPOIS:**
```typescript
const handleSubmit = async (formData) => {
  if (editingId) {
    await apiClient
      .from('tabela')
      .update({ ...formData, id: editingId });
  } else {
    await apiClient
      .from('tabela')
      .insert(formData);
  }
};
```

---

## ⚠️ Diferenças Importantes

### 1. Estrutura de Resposta

**Supabase:**
- Retorna `{ data, error }`
- `data` pode ser `null` mesmo sem erro

**API Própria:**
- Retorna dados diretamente
- Erros são lançados como exceções
- Use `try/catch` para tratamento

### 2. Autenticação

**Supabase:**
- Sessão gerenciada automaticamente
- `onAuthStateChange` para listeners

**API Própria:**
- Token armazenado em `localStorage`
- Use `useAuth()` hook para estado
- Eventos customizados para mudanças

### 3. Filtros Complexos

**Supabase:**
- Suporta `.or()`, `.and()`, joins

**API Própria:**
- Suporta filtros básicos (eq, neq, gt, etc.)
- `.or()` ainda não implementado
- Joins precisam de RPC ou queries customizadas

---

## 📝 Checklist por Componente

Para cada componente, verifique:

- [ ] Substituir import do Supabase
- [ ] Substituir `supabase.from()` por `apiClient.from()`
- [ ] Substituir `supabase.auth` por `useAuth()` ou `apiClient`
- [ ] Substituir `supabase.storage` por `apiClient.uploadFile()` / `getPublicUrl()`
- [ ] Trocar `{ data, error }` por `try/catch`
- [ ] Ajustar tratamento de erros
- [ ] Testar funcionalidade
- [ ] Verificar loading states
- [ ] Verificar validações

---

## 🚀 Exemplo Completo

### Componente ANTES (Supabase)

```typescript
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export function AlunosList() {
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlunos = async () => {
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .eq('coach_id', userId)
        .order('nome');
      
      if (error) {
        console.error(error);
        return;
      }
      
      setAlunos(data || []);
      setLoading(false);
    };

    fetchAlunos();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      {alunos.map(aluno => (
        <div key={aluno.id}>{aluno.nome}</div>
      ))}
    </div>
  );
}
```

### Componente DEPOIS (API Própria)

```typescript
import { apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';

export function AlunosList() {
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlunos = async () => {
      try {
        const data = await apiClient
          .from('alunos')
          .select('*')
          .eq('coach_id', userId)
          .order('nome');
        
        setAlunos(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlunos();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div>
      {alunos.map(aluno => (
        <div key={aluno.id}>{aluno.nome}</div>
      ))}
    </div>
  );
}
```

---

## 📊 Componentes Prioritários

### Alta Prioridade
1. `Dashboard.tsx` - Página principal
2. `StudentManager.tsx` - Gestão de alunos
3. `StudentDetails.tsx` - Detalhes do aluno
4. `Auth.tsx` - ✅ Já migrado

### Média Prioridade
5. `FoodManager.tsx` - Gestão de alimentos
6. `PaymentManager.tsx` - Gestão de pagamentos
7. `MessageManager.tsx` - Mensagens
8. `EventsCalendar.tsx` - Calendário

### Baixa Prioridade
9. Componentes de aluno (`student/*`)
10. Scripts de importação

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Guia completo e pronto para uso
