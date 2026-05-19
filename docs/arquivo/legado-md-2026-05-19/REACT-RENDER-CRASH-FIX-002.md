# REACT-RENDER-CRASH-FIX-002

**Status**: 🔍 EM ANÁLISE  
**Título**: Múltiplos Componentes Usando Hooks do React Router Antes do Router Estar Pronto  
**Data**: 2026-01-23

---

## PROBLEMAS IDENTIFICADOS

### 1. AppLayout usa useSearchParams() no nível superior
**Arquivo**: `src/components/AppLayout.tsx`  
**Linha**: 27  
**Problema**: `useSearchParams()` é chamado durante render inicial, pode falhar se Router não estiver completamente inicializado

### 2. Sidebar usa useNavigate() no nível superior
**Arquivo**: `src/components/Sidebar.tsx`  
**Linha**: 44  
**Problema**: `useNavigate()` é chamado durante render inicial, pode falhar se Router não estiver completamente inicializado

---

## ANÁLISE

Embora o `BrowserRouter` esteja montado antes do `BootstrapGuard`, há um problema de timing:

1. BrowserRouter monta
2. BootstrapGuard renderiza (estado INIT)
3. Estado muda para READY
4. Routes renderiza Index
5. Index renderiza AppLayout
6. **AppLayout tenta usar useSearchParams() mas Router pode não estar completamente inicializado**
7. **Sidebar tenta usar useNavigate() mas Router pode não estar completamente inicializado**

---

## SOLUÇÃO PROPOSTA

### Opção 1: Proteger hooks com try/catch (NÃO RECOMENDADO)
- Mascararia o erro, não resolveria a causa

### Opção 2: Lazy initialization dos hooks (RECOMENDADO)
- Usar hooks apenas quando necessário
- Não chamar hooks no nível superior se não forem críticos para o render inicial

### Opção 3: Wrapper que verifica Router disponível (MELHOR)
- Criar um componente que verifica se Router está disponível
- Só renderiza filhos quando Router estiver pronto

---

## CORREÇÃO A APLICAR

### Para AppLayout:
- `useSearchParams()` pode ser usado, mas precisa de fallback seguro
- Verificar se searchParams está disponível antes de usar

### Para Sidebar:
- `useNavigate()` pode ser usado, mas precisa de fallback seguro
- Verificar se navigate está disponível antes de usar

### Alternativa: Mover hooks para dentro de handlers/useEffect
- useNavigate() só é usado em handlers, pode ser lazy
- useSearchParams() é usado no render, precisa estar disponível

---

## DECISÃO

Aplicar proteção defensiva nos hooks do React Router para garantir que não quebrem durante render inicial.
