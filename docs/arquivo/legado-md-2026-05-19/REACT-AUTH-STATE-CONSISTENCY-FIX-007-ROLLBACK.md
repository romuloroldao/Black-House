# Plano de Rollback - FIX-007

## 🔄 Como Reverter o FIX-007 (Se Necessário)

**Motivo para este documento**: Em caso de problemas inesperados em produção, este documento permite reverter rapidamente para o estado anterior.

---

## ⚠️ Quando Fazer Rollback

Faça rollback **IMEDIATAMENTE** se:
- [ ] Login parar de funcionar completamente (> 50% falhas)
- [ ] Loops de redirecionamento voltarem (mas diferentes do bug original)
- [ ] Crashes sistemáticos no AuthContext
- [ ] Incompatibilidade com backend (versão antiga da API)

**NÃO** faça rollback se:
- [ ] Login está lento (investigar backend/rede primeiro)
- [ ] Um usuário específico tem problema (investigar dados do usuário)
- [ ] Logs aparecem no console (são intencionais para debug)

---

## 📝 Mudanças a Reverter

### 1. src/contexts/AuthContext.tsx

#### Reverter: Interface AuthContextType
**Linhas ~20-27**

```typescript
// ❌ REMOVER:
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;  // ← REMOVER
  signOut: () => Promise<void>;
  role?: 'coach' | 'aluno';
  payment_status?: 'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE';
}

// ✅ RESTAURAR:
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  role?: 'coach' | 'aluno';
  payment_status?: 'CURRENT' | 'OVERDUE' | 'PENDING_AFTER_DUE_DATE';
}
```

#### Reverter: Método login()
**Linhas ~173-211**

```typescript
// ❌ REMOVER TODO O MÉTODO login():
const login = async (email: string, password: string) => {
  setLoading(true);
  try {
    // ...
  } finally {
    setLoading(false);
  }
};

// ❌ REMOVER do Provider:
return (
  <AuthContext.Provider value={{ user, session, loading, login, signOut, role, payment_status }}>
    {children}
  </AuthContext.Provider>
);

// ✅ RESTAURAR Provider original:
return (
  <AuthContext.Provider value={{ user, session, loading, signOut, role, payment_status }}>
    {children}
  </AuthContext.Provider>
);
```

#### Reverter: Hook useAuth()
**Linhas ~190-206**

```typescript
// ❌ REMOVER:
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('[DESIGN-023] useAuth usado fora de AuthProvider. Retornando valores padrão.');
    return {
      user: null,
      session: null,
      loading: true,
      login: async () => { throw new Error('AuthProvider não disponível'); },
      signOut: async () => {},
      role: undefined,
      payment_status: undefined,
    };
  }
  return context;
};

// ✅ RESTAURAR:
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('[DESIGN-023] useAuth usado fora de AuthProvider. Retornando valores padrão.');
    return {
      user: null,
      loading: true,
      signIn: async () => ({ error: 'AuthProvider não disponível' }),
      signUp: async () => ({ error: 'AuthProvider não disponível' }),
      signOut: async () => {},
      role: null,
    };
  }
  return context;
};
```

### 2. src/pages/Auth.tsx

#### Reverter: Desestruturação do useAuth
**Linha ~70**

```typescript
// ❌ REMOVER:
const { user, login } = useAuth();

// ✅ RESTAURAR:
const { user } = useAuth();
```

#### Reverter: useEffect
**Linhas ~72-87**

```typescript
// ❌ REMOVER log:
useEffect(() => {
  if (user) {
    console.log('[REACT-AUTH-STATE-CONSISTENCY-FIX-007] Usuário autenticado detectado, redirecionando...');
    navigate('/');
  }
  // ...
}, [navigate, user]);

// ✅ RESTAURAR:
useEffect(() => {
  if (user) {
    navigate('/');
  }
  // ...
}, [navigate, user]);
```

#### Reverter: handleSignIn
**Linhas ~174-242**

```typescript
// ❌ REMOVER:
const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrors({});
  
  const result = signInSchema.safeParse({ email, password });
  if (!result.success) {
    // ...
    return;
  }

  try {
    setLoading(true);
    
    // REACT-AUTH-STATE-CONSISTENCY-FIX-007: Usar método login() do AuthContext
    await login(email, password);

    toast({
      title: "Bem-vindo de volta!",
      description: "Login realizado com sucesso.",
    });
    
    // REACT-AUTH-STATE-CONSISTENCY-FIX-007: REMOVER navigate() imperativo
    // navigate('/');
  } catch (error: any) {
    // ...
  } finally {
    setLoading(false);
  }
};

// ✅ RESTAURAR:
const handleSignIn = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrors({});
  
  const result = signInSchema.safeParse({ email, password });
  if (!result.success) {
    // ...
    return;
  }

  try {
    setLoading(true);
    
    await apiClient.signIn(email, password);

    toast({
      title: "Bem-vindo de volta!",
      description: "Login realizado com sucesso.",
    });
    
    navigate('/');
  } catch (error: any) {
    // ...
  } finally {
    setLoading(false);
  }
};
```

### 3. src/components/ProtectedRoute.tsx

#### Reverter: Log de diagnóstico
**Linhas ~39-47**

```typescript
// ❌ REMOVER:
console.log('[REACT-AUTH-STATE-CONSISTENCY-FIX-007] ProtectedRoute:', { 
  loading, 
  forceRender, 
  hasUser: !!user,
  userEmail: user?.email,
  role: role || user?.role
});

// ✅ RESTAURAR:
console.log('[REACT-SOFT-LOCK-FIX-005] ProtectedRoute:', { loading, forceRender, hasUser: !!user });
```

---

## 🔧 Comandos de Rollback

### Git Rollback (Recomendado se commits já foram feitos)

```bash
# 1. Verificar último commit antes do FIX-007
git log --oneline -10

# 2. Criar branch de rollback
git checkout -b rollback/fix-007

# 3. Reverter commits do FIX-007
git revert <commit-hash-do-fix-007>

# 4. Testar
npm run dev

# 5. Se tudo ok, fazer merge
git checkout main
git merge rollback/fix-007
```

### Manual Rollback (Se preferir editar manualmente)

```bash
# 1. Criar backup do estado atual
cp src/contexts/AuthContext.tsx src/contexts/AuthContext.tsx.fix007.backup
cp src/pages/Auth.tsx src/pages/Auth.tsx.fix007.backup
cp src/components/ProtectedRoute.tsx src/components/ProtectedRoute.tsx.fix007.backup

# 2. Aplicar mudanças acima manualmente em cada arquivo

# 3. Testar
npm run dev

# 4. Se tudo ok, commit
git add .
git commit -m "Rollback: REACT-AUTH-STATE-CONSISTENCY-FIX-007"
```

---

## 🧪 Testes Pós-Rollback

Após fazer rollback, executar os seguintes testes:

1. **Login básico funciona?**
   ```
   [ ] Fazer login com credenciais válidas
   [ ] Verificar se dashboard aparece (pode ter delay)
   [ ] Verificar se há loops (pode voltar a ter o bug original)
   ```

2. **Comportamento esperado pós-rollback:**
   - Login pode voltar a ter loops (bug original)
   - Toast de sucesso aparece mas permanece na tela de login
   - Necessário refresh manual em alguns casos
   - **ISSO É O COMPORTAMENTO ANTERIOR AO FIX**

3. **Se rollback resolver problema crítico:**
   - Investigar causa do problema
   - Corrigir FIX-007 e re-aplicar
   - Documentar causa do problema

---

## 📊 Comparação Pós-Rollback

| Aspecto | Pós-FIX-007 | Pós-Rollback |
|---------|-------------|--------------|
| Login funciona | ✅ Sim | ✅ Sim (mas com bug original) |
| Loops de redirect | ❌ Não | ⚠️ Sim (bug original) |
| Consistência estado | ✅ Sempre | ❌ Às vezes |
| UX | ✅ Instantânea | ⚠️ Pode travar |

---

## 🚨 Investigação de Problemas

Se precisou fazer rollback, investigar:

### 1. Backend Incompatível?
```bash
# Verificar se API retorna dados esperados
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Deve retornar: { "token": "...", ... }
```

```bash
# Verificar se /auth/user funciona
curl http://localhost:3001/auth/user \
  -H "Authorization: Bearer <token>"

# Deve retornar: { "user": {...}, "role": "...", "payment_status": "..." }
```

### 2. Race Condition Nova?
- Adicionar logs no AuthContext.login()
- Verificar ordem de execução
- Verificar se setUser está sendo chamado

### 3. TypeScript Errors?
```bash
npm run type-check
```

---

## 📞 Contato em Caso de Emergência

Se precisou fazer rollback em produção:

1. **Notificar equipe**
   - Tech Lead
   - Product Owner
   - DevOps

2. **Criar issue urgente**
   - Tag: `[ROLLBACK]` `[CRITICAL]` `[FIX-007]`
   - Incluir logs e screenshots
   - Incluir passos para reproduzir problema

3. **Documentar causa raiz**
   - O que causou a necessidade de rollback?
   - Qual foi o impacto?
   - Como prevenir no futuro?

---

## 🎯 Re-aplicação do FIX-007

Depois de investigar e corrigir o problema que causou o rollback:

1. Criar branch de re-aplicação
2. Re-implementar FIX-007 com correções
3. Testar extensivamente em staging
4. Code review duplo
5. Deploy gradual (canary/blue-green)

---

**Criado em**: 2026-01-25  
**Versão**: 1.0  
**Última atualização**: 2026-01-25  
**Responsável**: Equipe de Desenvolvimento
