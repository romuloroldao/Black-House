# 📋 Plano de Migração do Frontend

**Data**: 12 de Janeiro de 2026  
**Status**: ⚠️ **PENDENTE**

---

## 📊 Análise Atual

### Arquivos que Usam Supabase

**Total encontrado**: 32 arquivos

#### Categorias de Arquivos:

1. **Integração Base** (2 arquivos)
   - `src/integrations/supabase/client.ts` - Cliente Supabase
   - `src/integrations/supabase/types.ts` - Tipos TypeScript

2. **Contextos** (1 arquivo)
   - `src/contexts/AuthContext.tsx` - Contexto de autenticação

3. **Páginas** (3 arquivos)
   - `src/pages/Auth.tsx` - Página de autenticação
   - `src/pages/StudentPortal.tsx` - Portal do aluno
   - `src/pages/ReportViewPage.tsx` - Visualização de relatórios

4. **Componentes** (24 arquivos)
   - Componentes de gestão (Dashboard, StudentManager, etc.)
   - Componentes de aluno (StudentProgressView, StudentChatView, etc.)
   - Componentes de funcionalidades (FoodManager, PaymentManager, etc.)

5. **Scripts** (2 arquivos)
   - `src/scripts/import-taco-foods.ts` - Importação de alimentos TACO
   - `src/scripts/import-alimentos.ts` - Importação de alimentos

---

## ✅ O Que Já Está Pronto

### 1. Cliente de API
- ✅ `src/lib/api-client.ts` criado e funcional
- ✅ Métodos de autenticação implementados
- ✅ Métodos de queries implementados
- ✅ Métodos de storage implementados
- ✅ Métodos RPC implementados

### 2. Variáveis de Ambiente
- ✅ `VITE_API_URL` definida no `.env.production`
- ⚠️ Ainda existem variáveis `VITE_SUPABASE_*` no `.env`

---

## 🔄 Plano de Migração

### Fase 1: Preparação

#### 1.1 Atualizar Variáveis de Ambiente
```bash
# Adicionar ao .env
VITE_API_URL=http://localhost:3001

# Adicionar ao .env.production
VITE_API_URL=https://api.blackhouse.app.br
```

#### 1.2 Criar Wrapper de Compatibilidade (Opcional)
Criar um wrapper que mantém a mesma interface do Supabase mas usa `apiClient` internamente.

### Fase 2: Migração por Prioridade

#### Prioridade 1: Autenticação (Crítico)
- [ ] `src/contexts/AuthContext.tsx`
- [ ] `src/pages/Auth.tsx`
- [ ] `src/integrations/supabase/client.ts` (substituir ou remover)

**Mudanças necessárias**:
```typescript
// ANTES
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)
await supabase.auth.signUp({ email, password })

// DEPOIS
import { apiClient } from '@/lib/api-client'
await apiClient.signUp(email, password)
```

#### Prioridade 2: Queries de Banco (Alto)
- [ ] `src/components/Dashboard.tsx`
- [ ] `src/components/StudentManager.tsx`
- [ ] `src/components/StudentDetails.tsx`
- [ ] `src/components/FoodManager.tsx`
- [ ] `src/components/PaymentManager.tsx`
- [ ] `src/components/PlanManager.tsx`
- [ ] `src/components/MessageManager.tsx`
- [ ] `src/components/EventsCalendar.tsx`
- [ ] `src/components/DietCreator.tsx`
- [ ] `src/components/WorkoutForm.tsx`

**Mudanças necessárias**:
```typescript
// ANTES
const { data } = await supabase
  .from('alunos')
  .select('*')
  .eq('coach_id', userId)

// DEPOIS
const data = await apiClient
  .from('alunos')
  .select('*')
// Filtros precisam ser implementados na API ou no cliente
```

#### Prioridade 3: Storage (Médio)
- [ ] `src/components/StudentImporter.tsx`
- [ ] Componentes que fazem upload de arquivos
- [ ] Componentes que exibem imagens

**Mudanças necessárias**:
```typescript
// ANTES
await supabase.storage
  .from('avatars')
  .upload('path', file)
const url = supabase.storage
  .from('avatars')
  .getPublicUrl('path')

// DEPOIS
await apiClient.uploadFile('avatars', 'path', file)
const url = apiClient.getPublicUrl('avatars', 'path')
```

#### Prioridade 4: Componentes de Aluno (Médio)
- [ ] `src/pages/StudentPortal.tsx`
- [ ] `src/components/student/*` (todos os componentes)

#### Prioridade 5: Scripts e Utilitários (Baixo)
- [ ] `src/scripts/import-taco-foods.ts`
- [ ] `src/scripts/import-alimentos.ts`

---

## 🔧 Adaptações Necessárias na API

### 1. Filtros e Queries Complexas

O Supabase permite queries como:
```typescript
supabase
  .from('alunos')
  .select('*')
  .eq('coach_id', userId)
  .order('created_at', { ascending: false })
  .limit(10)
```

A API atual precisa ser expandida para suportar:
- Filtros (eq, neq, gt, gte, lt, lte, like, ilike, in)
- Ordenação
- Limites e paginação
- Joins (se necessário)

### 2. RLS (Row Level Security)

O Supabase tem RLS nativo. Na API própria, precisamos:
- Implementar verificação de permissões na API
- Garantir que cada coach só acessa seus dados
- Garantir que alunos só acessam seus dados

### 3. Realtime (Opcional)

Se o frontend usa realtime do Supabase:
- Implementar WebSockets na API
- Ou usar polling
- Ou remover funcionalidade realtime

---

## 📝 Checklist de Migração

### Preparação
- [ ] Atualizar variáveis de ambiente
- [ ] Criar documentação de mapeamento Supabase → API
- [ ] Testar apiClient isoladamente

### Autenticação
- [ ] Migrar AuthContext
- [ ] Migrar página Auth
- [ ] Testar login/logout
- [ ] Testar registro
- [ ] Testar recuperação de senha (se houver)

### Queries
- [ ] Migrar Dashboard
- [ ] Migrar StudentManager
- [ ] Migrar StudentDetails
- [ ] Migrar FoodManager
- [ ] Migrar PaymentManager
- [ ] Migrar outros componentes principais
- [ ] Testar cada componente migrado

### Storage
- [ ] Migrar uploads de arquivos
- [ ] Migrar exibição de imagens
- [ ] Testar upload/download

### Componentes de Aluno
- [ ] Migrar StudentPortal
- [ ] Migrar componentes student/*
- [ ] Testar funcionalidades do aluno

### Scripts
- [ ] Migrar scripts de importação
- [ ] Testar scripts

### Limpeza
- [ ] Remover dependência @supabase/supabase-js
- [ ] Remover pasta src/integrations/supabase
- [ ] Remover variáveis VITE_SUPABASE_* do .env
- [ ] Atualizar documentação

---

## 🚨 Desafios e Considerações

### 1. Diferenças de API

**Supabase**:
- Query builder fluente
- RLS automático
- Realtime nativo
- Storage integrado

**API Própria**:
- REST simples
- RLS precisa ser implementado
- Sem realtime (precisa implementar)
- Storage local

### 2. Compatibilidade

Algumas funcionalidades podem precisar de adaptação:
- Filtros complexos
- Joins
- Agregações
- Realtime subscriptions

### 3. Testes

Cada componente migrado precisa ser testado:
- Funcionalidade básica
- Tratamento de erros
- Estados de loading
- Validações

---

## 📊 Progresso Estimado

- **Preparação**: 1-2 horas
- **Autenticação**: 2-3 horas
- **Queries principais**: 4-6 horas
- **Storage**: 2-3 horas
- **Componentes de aluno**: 3-4 horas
- **Scripts**: 1-2 horas
- **Testes e ajustes**: 3-4 horas

**Total estimado**: 16-24 horas

---

## 🎯 Próximos Passos Imediatos

1. **Atualizar variáveis de ambiente**
   ```bash
   echo "VITE_API_URL=http://localhost:3001" >> .env
   ```

2. **Começar pela autenticação**
   - Migrar AuthContext primeiro
   - Testar isoladamente
   - Depois migrar página Auth

3. **Expandir API se necessário**
   - Adicionar suporte a filtros
   - Adicionar suporte a ordenação
   - Implementar RLS básico

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ⚠️ Planejamento completo - Aguardando início da migração
