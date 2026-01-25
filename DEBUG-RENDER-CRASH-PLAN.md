# PLANO DE ISOLAMENTO BINÁRIO - DEBUG RENDER CRASH

## ESTRATÉGIA DE ISOLAMENTO

### FASE 1: Render Mínimo (CONFIRMAÇÃO)
Substituir App.tsx por render mínimo para confirmar que o problema é no React render.

```tsx
const App = () => <div>OK</div>;
```

**Se OK aparece**: Problema está em algum componente filho
**Se ainda crasha**: Problema está antes do React (runtime shield, main.tsx)

---

### FASE 2: Reativar Providers Um Por Vez

#### 2.1 QueryClientProvider
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <div>OK</div>
  </QueryClientProvider>
);
```

#### 2.2 AuthProvider
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <div>OK</div>
    </AuthProvider>
  </QueryClientProvider>
);
```

#### 2.3 DataContextProvider
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataContextProvider>
        <div>OK</div>
      </DataContextProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

#### 2.4 BootstrapAwareErrorBoundary
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataContextProvider>
        <BootstrapAwareErrorBoundary>
          <div>OK</div>
        </BootstrapAwareErrorBoundary>
      </DataContextProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

#### 2.5 BootstrapGuard
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataContextProvider>
        <BootstrapAwareErrorBoundary>
          <BootstrapGuard>
            <div>OK</div>
          </BootstrapGuard>
        </BootstrapAwareErrorBoundary>
      </DataContextProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

---

### FASE 3: Reativar Rotas

#### 3.1 BrowserRouter + Routes vazio
```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DataContextProvider>
        <BootstrapAwareErrorBoundary>
          <BootstrapGuard>
            <TooltipProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="*" element={<div>OK</div>} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </BootstrapGuard>
        </BootstrapAwareErrorBoundary>
      </DataContextProvider>
    </AuthProvider>
  </QueryClientProvider>
);
```

#### 3.2 Rota /auth
```tsx
<Route path="/auth" element={<Auth />} />
```

#### 3.3 Rota / (Index)
```tsx
<Route path="/" element={<Index />} />
```

---

## PADRÕES PROBLEMÁTICOS A VERIFICAR

### 1. Retornos Inválidos
- ❌ `return;` (sem valor)
- ❌ `return undefined;`
- ❌ `return false;`
- ❌ `return {};`
- ✅ `return null;` (válido)
- ✅ `return <Component />;` (válido)

### 2. Condicionais Sem Return Final
```tsx
// ❌ PROBLEMA
const Component = () => {
  if (condition) {
    return <A />;
  }
  // Sem return final - retorna undefined
};

// ✅ CORRETO
const Component = () => {
  if (condition) {
    return <A />;
  }
  return null; // ou <B />
};
```

### 3. Desestruturação Insegura
```tsx
// ❌ PROBLEMA
const { prop } = obj; // obj pode ser null/undefined

// ✅ CORRETO
const { prop } = obj || {};
const prop = obj?.prop;
```

### 4. Métodos Sem Validação
```tsx
// ❌ PROBLEMA
str.charAt(0);
arr.map(...);
arr.length;

// ✅ CORRETO
(str && str.length > 0) ? str.charAt(0) : '';
Array.isArray(arr) ? arr.map(...) : [];
arr?.length || 0;
```

### 5. Hooks Retornando Undefined
```tsx
// ❌ PROBLEMA
const context = useContext(Context);
context.prop; // context pode ser undefined

// ✅ CORRETO
const context = useContext(Context);
const prop = context?.prop || defaultValue;
```

---

## COMPONENTES SUSPEITOS (ORDEM DE PRIORIDADE)

1. **BootstrapGuard** - Verifica estado e pode ter caminho sem return
2. **ProtectedRoute** - Múltiplos condicionais, pode ter caminho sem return
3. **Sidebar** - Renderizado no AppLayout, pode ter problema em SidebarContent
4. **AppLayout** - Renderiza conteúdo dinâmico via switch
5. **Index** - Rota raiz, renderiza AppLayout

---

## CHECKLIST DE AUDITORIA

Para cada componente suspeito, verificar:

- [ ] Todos os caminhos de código têm return explícito?
- [ ] Nenhum return sem valor (`return;`)?
- [ ] Nenhum return de undefined/false/{}?
- [ ] Todas as desestruturações têm fallback?
- [ ] Todos os métodos de string/array têm validação?
- [ ] Todos os hooks têm tratamento de undefined?
- [ ] Condicionais JSX têm fallback (`condition && <Component />` → `condition ? <Component /> : null`)?
