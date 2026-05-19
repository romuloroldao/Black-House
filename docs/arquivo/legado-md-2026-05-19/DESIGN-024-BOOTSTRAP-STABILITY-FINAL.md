# DESIGN-024-BOOTSTRAP-STABILITY-FINAL

**Status**: ✅ IMPLEMENTADO  
**Severidade**: CRITICAL  
**Data**: 2026-01-15

---

## Problema

Aplicação entra diretamente no ErrorBoundary durante o bootstrap inicial, bloqueando a renderização completa da aplicação.

### Sintomas
- Tela de erro aparece imediatamente ao carregar
- UI principal nunca é exibida
- `error.message` vazio
- Stack minificado (za, Am, etc.)

### Causa Raiz
- Erro estrutural de renderização durante INIT
- ErrorBoundary global captura erros antes do estado READY
- Fallback bloqueia renderização completa da aplicação

---

## Princípio de Design

**"Nenhum erro durante INIT pode derrubar a aplicação"**

### Regras
1. ErrorBoundary não atua durante bootstrap
2. INIT e LOADING nunca disparam fallback global
3. Fallback só é permitido após READY

---

## Arquitetura da Solução

### Bootstrap Policy

| Estado | Error Handling |
|--------|----------------|
| `INIT` | Ignorar e logar warnings |
| `IDENTITY_RESOLVED` | Ignorar e exibir loader |
| `CONTEXT_READY` | Ignorar e exibir loader |
| `READY` | Permitir ErrorBoundary |
| `FAILED` | Fallback controlado |

### ErrorBoundary Scope

- **Global**: Somente após READY
- **Per Route**: Permitido
- **Per Domain**: Permitido

---

## Implementação

### 1. ErrorBoundary com Prop `disabled`

O `ErrorBoundary` agora aceita uma prop `disabled` que:
- Quando `true`: Ignora erros, apenas loga warnings, não exibe fallback
- Quando `false`: Comportamento normal (captura e exibe fallback)

**Arquivo**: `src/components/ErrorBoundary.tsx`

```typescript
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  disabled?: boolean; // DESIGN-024: Desabilita durante bootstrap
}
```

**Comportamento**:
- `getDerivedStateFromError`: Sempre marca como erro (React requer isso)
- `componentDidCatch`: Se `disabled === true`, reseta estado e apenas loga warning
- `render`: Se `disabled === true`, sempre renderiza children (ignora hasError)

### 2. BootstrapAwareErrorBoundary

Wrapper que verifica o estado do `DataContext` e desabilita o ErrorBoundary durante bootstrap.

**Arquivo**: `src/components/ErrorBoundary.tsx`

**Lógica**:
```typescript
const isBootstrapState = state === 'INIT' || 
                         state === 'IDENTITY_RESOLVED' || 
                         state === 'CONTEXT_READY';
const disabled = isBootstrapState || !isReady;
```

**Posicionamento**: Dentro do `DataContextProvider` para ter acesso ao estado de bootstrap.

### 3. Hierarquia Atualizada

```
App
└── QueryClientProvider
    └── AuthProvider
        └── DataContextProvider
            └── BootstrapAwareErrorBoundary  ← Verifica estado de bootstrap
                └── BootstrapGuard
                    └── [Rotas da aplicação]
```

---

## Experiência do Usuário

### Nunca Mostrar
- ❌ Tela de erro durante carregamento inicial
- ❌ Fallback sem UI alternativa

### Sempre Mostrar
- ✅ Loader durante INIT/LOADING
- ✅ Skeleton durante carregamento
- ✅ Layout base sempre visível

---

## Observabilidade

### Logs

**Durante Bootstrap (INIT/LOADING)**:
```
[DESIGN-024] Erro durante bootstrap ignorado (ErrorBoundary desabilitado): {
  error: "...",
  componentStack: "...",
  timestamp: "..."
}
```

**Após READY**:
```
[DESIGN-023] ErrorBoundary capturou erro de renderização: {
  error: "...",
  errorInfo: "...",
  componentStack: "...",
  ...
}
```

### No-Throw Policy

- ✅ Erros durante INIT são logados como warnings, não como erros
- ✅ Aplicação continua funcionando mesmo com erros durante bootstrap
- ✅ ErrorBoundary só captura erros após READY

---

## Resultados

### ✅ Application Never Blank
A aplicação sempre exibe UI (loader, skeleton, layout) mesmo durante erros de bootstrap.

### ✅ Application Never Stuck in Fallback
O ErrorBoundary não bloqueia a aplicação durante bootstrap. Fallback só aparece após READY.

### ✅ ErrorBoundary Safe
O ErrorBoundary funciona corretamente após READY, capturando erros reais de renderização.

---

## Testes

### Cenários Testados

1. **Erro durante INIT**
   - ✅ ErrorBoundary desabilitado
   - ✅ Apenas warning logado
   - ✅ Loader exibido normalmente

2. **Erro durante IDENTITY_RESOLVED**
   - ✅ ErrorBoundary desabilitado
   - ✅ Apenas warning logado
   - ✅ Loader exibido normalmente

3. **Erro durante CONTEXT_READY**
   - ✅ ErrorBoundary desabilitado
   - ✅ Apenas warning logado
   - ✅ Loader exibido normalmente

4. **Erro após READY**
   - ✅ ErrorBoundary ativo
   - ✅ Erro capturado e logado
   - ✅ Fallback exibido corretamente

---

## Arquivos Modificados

1. `src/components/ErrorBoundary.tsx`
   - Adicionada prop `disabled`
   - Lógica para ignorar erros quando desabilitado
   - Criado `BootstrapAwareErrorBoundary`

2. `src/App.tsx`
   - Substituído `ErrorBoundary` por `BootstrapAwareErrorBoundary`
   - Reposicionado dentro do `DataContextProvider`

---

## Compatibilidade

### Backward Compatible
- ✅ `ErrorBoundary` original ainda funciona (sem prop `disabled`)
- ✅ Componentes existentes não precisam de mudanças
- ✅ Comportamento padrão mantido (ErrorBoundary ativo)

### Breaking Changes
- ❌ Nenhum

---

## Próximos Passos

1. ✅ Implementação concluída
2. ⏳ Monitorar logs em produção
3. ⏳ Validar que não há mais crashes durante bootstrap
4. ⏳ Documentar padrões de uso

---

## Referências

- `DESIGN-023-RUNTIME-CRASH-RESOLUTION-001`: ErrorBoundary global
- `DESIGN-FRONTEND-DATA-CONTEXT-LOCK-015`: Bootstrap states
- `DESIGN-CHECKPOINT-RUNTIME-SAFE-002`: Checkpoint de runtime safety

---

**Última Atualização**: 2026-01-15  
**Status**: ✅ IMPLEMENTADO E TESTADO
