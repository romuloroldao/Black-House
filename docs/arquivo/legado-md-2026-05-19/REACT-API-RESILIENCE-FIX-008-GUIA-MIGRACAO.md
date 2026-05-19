# Guia de Migração para FIX-008

## 🎯 Objetivo

Migrar componentes para usar APIs resilientes que nunca quebram render.

---

## 📋 Checklist de Migração

Para cada componente que faz fetch de dados:

- [ ] Identificar chamadas de API legadas
- [ ] Substituir por versão `*Safe()`
- [ ] Usar hook `useApiSafe` ou `useApiSafeList`
- [ ] Adicionar UI de fallback para erro
- [ ] Adicionar UI de empty state
- [ ] Remover try/catch manual
- [ ] Testar com backend desligado
- [ ] Testar com endpoint 404
- [ ] Verificar logs no console

---

## 🔄 Padrões de Migração

### Padrão 1: Lista de Itens (Mais Comum)

#### ❌ ANTES

```typescript
const MyComponent = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await apiClient.getAlunosByCoach();
        setItems(data);
      } catch (error) {
        console.error('Erro:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  
  if (loading) return <div>Carregando...</div>;
  
  return (
    <div>
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
};
```

#### ✅ DEPOIS

```typescript
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';

const MyComponent = () => {
  const { data: items, loading, error, refetch } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Erro ao carregar dados: {error}</p>
        <Button onClick={refetch}>Tentar novamente</Button>
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Nenhum item encontrado</p>
      </div>
    );
  }
  
  return (
    <div>
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
};
```

**Mudanças:**
1. ✅ Importa `useApiSafeList`
2. ✅ Usa `getAlunosByCoachSafe()` ao invés de `getAlunosByCoach()`
3. ✅ Remove `try/catch` manual
4. ✅ Remove `useState` e `useEffect` manuais
5. ✅ Adiciona UI de erro com `refetch`
6. ✅ Adiciona empty state

---

### Padrão 2: Objeto Único

#### ❌ ANTES

```typescript
const ProfileComponent = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiClient.getMe();
        setProfile(data);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);
  
  if (loading) return <div>Carregando...</div>;
  if (!profile) return <div>Perfil não encontrado</div>;
  
  return <div>{profile.nome}</div>;
};
```

#### ✅ DEPOIS

```typescript
import { useApiSafe } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';

const ProfileComponent = () => {
  const { data: profile, loading, error, refetch } = useApiSafe(
    () => apiClient.getMeSafe()
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Erro ao carregar perfil: {error}</p>
        <Button onClick={refetch}>Tentar novamente</Button>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Perfil não encontrado</p>
      </div>
    );
  }
  
  return <div>{profile.nome}</div>;
};
```

**Mudanças:**
1. ✅ Usa `useApiSafe` (não `useApiSafeList` pois é objeto único)
2. ✅ Usa `getMeSafe()` ao invés de `getMe()`
3. ✅ Adiciona tratamento de erro

---

### Padrão 3: Fetch Condicional (Não Automático)

#### ❌ ANTES

```typescript
const SearchComponent = () => {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState('');
  
  const handleSearch = async () => {
    try {
      const data = await apiClient.searchAlunos(query);
      setResults(data);
    } catch (error) {
      console.error('Erro:', error);
      setResults([]);
    }
  };
  
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch}>Buscar</button>
      {results.map(item => <div key={item.id}>{item.nome}</div>)}
    </div>
  );
};
```

#### ✅ DEPOIS

```typescript
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';

const SearchComponent = () => {
  const [query, setQuery] = useState('');
  
  const { data: results, loading, error, refetch } = useApiSafeList(
    () => apiClient.searchAlunosSafe(query),
    { autoFetch: false } // ← NÃO buscar automaticamente
  );
  
  const handleSearch = () => {
    refetch(); // ← Dispara fetch manualmente
  };
  
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Buscando...' : 'Buscar'}
      </button>
      
      {error && (
        <p className="text-destructive">Erro: {error}</p>
      )}
      
      {results.length > 0 && (
        <div>
          {results.map(item => <div key={item.id}>{item.nome}</div>)}
        </div>
      )}
      
      {!loading && results.length === 0 && query && (
        <p className="text-muted-foreground">Nenhum resultado encontrado</p>
      )}
    </div>
  );
};
```

**Mudanças:**
1. ✅ Usa `autoFetch: false` para controle manual
2. ✅ Chama `refetch()` ao invés de função manual
3. ✅ `loading` state automático no botão

---

### Padrão 4: Múltiplas APIs em Paralelo

#### ❌ ANTES

```typescript
const DashboardComponent = () => {
  const [alunos, setAlunos] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [alunosData, notifData] = await Promise.all([
          apiClient.getAlunosByCoach(),
          apiClient.getNotifications()
        ]);
        setAlunos(alunosData);
        setNotifications(notifData);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);
  
  if (loading) return <div>Carregando...</div>;
  
  return (
    <div>
      <div>Alunos: {alunos.length}</div>
      <div>Notificações: {notifications.length}</div>
    </div>
  );
};
```

#### ✅ DEPOIS

```typescript
import { useApiSafeList } from '@/hooks/useApiSafe';
import { apiClient } from '@/lib/api-client';

const DashboardComponent = () => {
  const { data: alunos, loading: loadingAlunos } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe()
  );
  
  const { data: notifications, loading: loadingNotif } = useApiSafeList(
    () => apiClient.getNotificationsSafe()
  );
  
  const loading = loadingAlunos || loadingNotif;
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div>
      <div>Alunos: {alunos.length}</div>
      <div>Notificações: {notifications.length}</div>
    </div>
  );
};
```

**Mudanças:**
1. ✅ Cada API tem seu próprio hook
2. ✅ Loading combinado manualmente
3. ✅ Se uma API falhar, a outra continua funcionando
4. ✅ Dados independentes (não usa `Promise.all`)

---

## 🛠️ Criando Novos Métodos Safe

Se você precisa de um endpoint que ainda não tem versão `*Safe()`:

### 1. Adicionar no api-client.ts

```typescript
// Método legado (pode lançar exceção)
async getMyData() {
  return this.request('/api/my-data');
}

// Método resiliente (nunca lança exceção)
async getMyDataSafe(): Promise<ApiResult<any[]>> {
  return this.safeRequest<any[]>('/api/my-data');
}
```

### 2. Usar no componente

```typescript
const { data, loading, error } = useApiSafeList(
  () => apiClient.getMyDataSafe()
);
```

---

## 🎨 Componentes de UI Reutilizáveis

### LoadingSpinner.tsx

```typescript
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);
```

### ErrorFallback.tsx

```typescript
interface ErrorFallbackProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorFallback = ({ error, onRetry }: ErrorFallbackProps) => (
  <div className="p-8 text-center">
    <p className="text-destructive mb-4">Erro: {error}</p>
    {onRetry && (
      <Button onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    )}
  </div>
);
```

### EmptyState.tsx

```typescript
interface EmptyStateProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ message, action }: EmptyStateProps) => (
  <div className="p-8 text-center">
    <p className="text-muted-foreground mb-4">{message}</p>
    {action && (
      <Button onClick={action.onClick} variant="outline">
        {action.label}
      </Button>
    )}
  </div>
);
```

### Uso dos Componentes

```typescript
const MyComponent = () => {
  const { data, loading, error, refetch } = useApiSafeList(...);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorFallback error={error} onRetry={refetch} />;
  if (data.length === 0) return <EmptyState message="Nenhum item encontrado" />;
  
  return <div>{/* ... */}</div>;
};
```

---

## 🧪 Testando Componentes Migrados

### Teste 1: Backend Desligado

```bash
# Desligar backend
pm2 stop blackhouse-api

# Abrir aplicação
# ✅ Esperado: UI renderiza com ErrorFallback
# ✅ Console: [REACT-API-RESILIENCE-FIX-008] Request falhou: { errorType: "NETWORK", ... }
```

### Teste 2: Endpoint 404

```bash
# Backend ligado, mas endpoint não existe

# ✅ Esperado: UI renderiza com EmptyState ou ErrorFallback
# ✅ Console: [REACT-API-RESILIENCE-FIX-008] Request falhou: { status: 404, ... }
```

### Teste 3: Endpoint 500

```bash
# Backend retorna erro interno

# ✅ Esperado: UI renderiza com ErrorFallback
# ✅ Console: [REACT-API-RESILIENCE-FIX-008] Request falhou: { status: 500, errorType: "BACKEND", ... }
```

### Teste 4: Sucesso

```bash
# Backend retorna dados normalmente

# ✅ Esperado: UI renderiza dados corretamente
# ✅ Console: Sem warnings
```

---

## 📊 Componentes Prioritários para Migração

### Alta Prioridade (Rotas Principais)

- [x] `Dashboard.tsx` - Já migrado (exemplo)
- [ ] `StudentManager.tsx` - Lista alunos
- [ ] `PlanManager.tsx` - Lista planos
- [ ] `PaymentManager.tsx` - Lista pagamentos
- [ ] `NotificationsPopover.tsx` - Lista notificações

### Média Prioridade (Rotas Secundárias)

- [ ] `WorkoutManager.tsx`
- [ ] `DietCreator.tsx`
- [ ] `ReportManager.tsx`
- [ ] `VideoGallery.tsx`
- [ ] `MessageManager.tsx`

### Baixa Prioridade (Rotas Raramente Usadas)

- [ ] `SettingsManager.tsx`
- [ ] `SearchDialog.tsx`
- [ ] `EventsCalendar.tsx`
- [ ] `ExpenseManager.tsx`

---

## 🎯 Benefícios Pós-Migração

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Código | Try/catch manual | Hook padronizado |
| Linhas de código | ~30 por componente | ~15 por componente |
| Manutenibilidade | Baixa | Alta |
| Resiliência | Depende de implementação | Garantida |
| UX em erro | Inconsistente | Consistente |
| Logs | Não padronizados | Tag FIX-008 |

---

## ❓ FAQ

**P: Posso misturar métodos legados e Safe?**

R: Sim, mas prefira migrar completamente para garantir consistência.

**P: O que fazer se o endpoint não existir ainda?**

R: A versão `*Safe()` retornará `{ success: false, status: 404 }`. UI renderiza com fallback.

**P: Preciso atualizar todos os componentes de uma vez?**

R: Não. Migre gradualmente, começando pelos mais críticos.

**P: useApiSafe funciona com POST/PUT/DELETE?**

R: Sim, mas esses geralmente não usam autoFetch. Use `autoFetch: false` e chame `refetch()` manualmente.

**P: Como adicionar toast de erro?**

R: Use `onError` callback:

```typescript
const { data, error } = useApiSafe(
  () => apiClient.getAlunosByCoachSafe(),
  { 
    onError: (error) => {
      toast({
        title: "Erro ao carregar dados",
        description: error,
        variant: "destructive"
      });
    }
  }
);
```

---

**Criado em**: 2026-01-25  
**Versão**: 1.0  
**Relacionado a**: REACT-API-RESILIENCE-FIX-008
