# Diagrama de Fluxo - REACT-AUTH-STATE-CONSISTENCY-FIX-007

## Arquitetura de Autenticação Pós-FIX-007

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          COMPONENTES DA UI                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ useAuth()
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                           AuthContext                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Estado:                                                            │  │
│  │  • user: User | null                                                │  │
│  │  • session: Session | null                                          │  │
│  │  • loading: boolean                                                 │  │
│  │  • role: 'coach' | 'aluno'                                          │  │
│  │  • payment_status: 'CURRENT' | 'OVERDUE' | 'PENDING'               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Métodos:                                                           │  │
│  │  • login(email, password): Promise<void>  ← NOVO (FIX-007)         │  │
│  │  • signOut(): Promise<void>                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ apiClient.*
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                           ApiClient                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Métodos HTTP:                                                      │  │
│  │  • signIn(email, password): Promise<{ token, ... }>                │  │
│  │  • getUser(): Promise<{ user, role, payment_status }>              │  │
│  │  • signOut(): Promise<void>                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                        Backend API (Express)                              │
│  • POST /auth/login                                                       │
│  • GET /auth/user                                                         │
│  • POST /auth/logout                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Login (Passo a Passo)

```
╔═══════════════════════════════════════════════════════════════════════╗
║                      1. USUÁRIO SUBMETE LOGIN                          ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
                                  │ handleSubmit(e)
                                  ↓
┌───────────────────────────────────────────────────────────────────────┐
│  Auth.tsx (UI Layer)                                                  │
│  ├─ Valida formulário (email, senha)                                  │
│  ├─ setLoading(true)                                                  │
│  └─ await login(email, password) ← Chama AuthContext                  │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  │
                                  ↓
╔═══════════════════════════════════════════════════════════════════════╗
║                      2. AUTHCONTEXT EXECUTA LOGIN                      ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
┌───────────────────────────────────────────────────────────────────────┐
│  AuthContext.login() (Business Logic Layer)                           │
│  ├─ setLoading(true)                                                  │
│  ├─ const response = await apiClient.signIn(email, password)          │
│  │   └─> Backend retorna { token, ... }                               │
│  ├─ const userData = await apiClient.getUser()                        │
│  │   └─> Backend retorna { user, role, payment_status }               │
│  ├─ const userWithRole = { ...userData.user, role, payment_status }   │
│  ├─ setUser(userWithRole)          ✅ Estado atualizado               │
│  ├─ setRole(role)                  ✅ Estado atualizado               │
│  ├─ setPaymentStatus(payment_status) ✅ Estado atualizado             │
│  ├─ setSession({ token, user })    ✅ Estado atualizado               │
│  └─ setLoading(false)              ✅ Loading concluído               │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Retorna (Promise resolvida)
                                  ↓
╔═══════════════════════════════════════════════════════════════════════╗
║                   3. AUTH.TSX RECEBE SUCESSO                           ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
┌───────────────────────────────────────────────────────────────────────┐
│  Auth.tsx (UI Layer)                                                  │
│  ├─ setLoading(false)                                                 │
│  └─ toast({ title: "Bem-vindo de volta!" })                           │
│  ❌ NÃO chama navigate('/') - Redirecionamento será REATIVO           │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ React re-renderiza
                                  ↓
╔═══════════════════════════════════════════════════════════════════════╗
║               4. USEEFFECT DETECTA MUDANÇA DE ESTADO                   ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
┌───────────────────────────────────────────────────────────────────────┐
│  Auth.tsx: useEffect(() => { ... }, [user])                           │
│  ├─ Detecta: user !== null                                            │
│  ├─ console.log('[FIX-007] Usuário autenticado, redirecionando...')  │
│  └─ navigate('/')                ✅ Redirecionamento REATIVO          │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ React Router muda rota
                                  ↓
╔═══════════════════════════════════════════════════════════════════════╗
║                   5. PROTECTEDROUTE VALIDA ACESSO                      ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
┌───────────────────────────────────────────────────────────────────────┐
│  ProtectedRoute (Guard)                                               │
│  ├─ const { user, loading, role } = useAuth()                         │
│  ├─ console.log({ loading: false, hasUser: true, role: 'coach' })    │
│  ├─ if (!user) → redirect /auth  ❌ NÃO executa (user existe!)        │
│  └─ return <>{children}</>       ✅ LIBERA ACESSO                     │
└───────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Renderiza children
                                  ↓
╔═══════════════════════════════════════════════════════════════════════╗
║                       6. DASHBOARD RENDERIZADO                         ║
╚═══════════════════════════════════════════════════════════════════════╝
                                  │
┌───────────────────────────────────────────────────────────────────────┐
│  Dashboard (Protected Page)                                           │
│  ├─ const { user } = useAuth()                                        │
│  ├─ Exibe: "Bem-vindo, {user.email}"                                  │
│  └─ Carrega dados do coach/aluno                                      │
└───────────────────────────────────────────────────────────────────────┘

✅ LOGIN COMPLETO EM < 1 SEGUNDO
```

---

## Comparação: Antes vs Depois

### ❌ ANTES DO FIX-007 (Fluxo Fragmentado)

```
Auth.tsx                      apiClient                  AuthContext
   │                              │                           │
   │ signIn(email, pwd)           │                           │
   ├──────────────────────────────>                           │
   │                              │                           │
   │                              │ setToken(token)           │
   │                              │ localStorage.setItem()    │
   │                              │                           │
   │                              │ dispatchEvent('auth-changed')
   │                              │───────────────────────────>│
   │                              │                           │
   │<─────────────────────────────┤                           │
   │ { token }                    │                           │
   │                              │                           │
   │ navigate('/') ⚡ IMPERATIVO  │                           │
   │ ❌ user ainda é null!        │                           │
   │                              │                           │
   │                         [evento assíncrono disparado]    │
   │                              │                           │
   │                              │        getUser() ⏱️       │
   │                              │<──────────────────────────┤
   │                              │        (demora...)        │
   │                              │                           │
   │                              │        { user }           │
   │                              │───────────────────────────>│
   │                              │                           │
   │                              │                 setUser(user)
   │                              │                 ⏰ TARDE DEMAIS!

ProtectedRoute já renderizou com user = null → Redirect para /auth
❌ LOOP INFINITO
```

### ✅ DEPOIS DO FIX-007 (Fluxo Centralizado)

```
Auth.tsx                     AuthContext                 apiClient
   │                              │                           │
   │ login(email, pwd)            │                           │
   ├──────────────────────────────>                           │
   │                              │                           │
   │                              │ signIn(email, pwd)        │
   │                              │───────────────────────────>│
   │                              │                           │
   │                              │<──────────────────────────┤
   │                              │ { token }                 │
   │                              │                           │
   │                              │ getUser()                 │
   │                              │───────────────────────────>│
   │                              │                           │
   │                              │<──────────────────────────┤
   │                              │ { user, role, payment }   │
   │                              │                           │
   │                   setUser(user) ✅                        │
   │                   setRole(role) ✅                        │
   │                   setSession(...) ✅                      │
   │                   setLoading(false) ✅                    │
   │                              │                           │
   │<─────────────────────────────┤                           │
   │ Promise resolved             │                           │
   │                              │                           │
   │ [useEffect detecta user]     │                           │
   │ navigate('/') ✅ REATIVO     │                           │

ProtectedRoute renderiza com user !== null → Libera acesso
✅ DASHBOARD EXIBIDO EM < 1s
```

---

## Garantias do FIX-007

### 1. Estado Sempre Consistente
```typescript
// ✅ GARANTIDO: Se login() resolve sem erro, user sempre está setado
await auth.login(email, password);
// Neste ponto, auth.user !== null (sempre!)
```

### 2. Redirecionamento Reativo
```typescript
// ✅ GARANTIDO: Navigate só acontece DEPOIS de user estar setado
useEffect(() => {
  if (user) {
    navigate('/');  // Só executa se user !== null
  }
}, [user, navigate]);
```

### 3. Guards Confiáveis
```typescript
// ✅ GARANTIDO: ProtectedRoute vê estado consistente
const { user } = useAuth();
if (!user) {
  return <Navigate to="/auth" />;
}
// Se chegar aqui, user está garantidamente setado
return <>{children}</>;
```

### 4. Sem Race Conditions
```typescript
// ❌ ANTES: Race condition entre navigate e setUser
await apiClient.signIn();  // Assíncrono
navigate('/');             // Executa imediatamente (user ainda null!)

// ✅ DEPOIS: Operações sequenciais garantidas
await auth.login();  // Espera user ser setado
// useEffect reage ao estado e navega
```

---

## Logs de Diagnóstico

### Console após login bem-sucedido:

```
[REACT-AUTH-STATE-CONSISTENCY-FIX-007] Login concluído com sucesso: {
  user: "coach@exemplo.com",
  role: "coach",
  hasUser: true
}

[REACT-AUTH-STATE-CONSISTENCY-FIX-007] Usuário autenticado detectado, redirecionando...

[REACT-AUTH-STATE-CONSISTENCY-FIX-007] ProtectedRoute: {
  loading: false,
  forceRender: false,
  hasUser: true,
  userEmail: "coach@exemplo.com",
  role: "coach"
}
```

---

## Benefícios Arquiteturais

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Responsabilidade** | Fragmentada (Auth.tsx + apiClient + listener) | Centralizada (AuthContext.login()) |
| **Consistência** | Token sem user (race condition) | Sempre consistente |
| **Testabilidade** | Difícil (múltiplos side effects) | Fácil (uma função, um resultado) |
| **Rastreabilidade** | Logs espalhados | Logs centralizados no login() |
| **Manutenibilidade** | Difícil (lógica em 3 lugares) | Fácil (lógica em 1 lugar) |
| **Debugging** | Complexo (ordem de execução incerta) | Simples (fluxo linear) |

---

**Criado em**: 2026-01-25  
**Tipo**: Documentação Técnica - Arquitetura de Autenticação  
**Relacionado a**: REACT-AUTH-STATE-CONSISTENCY-FIX-007
