# DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001

**Status**: ✅ IMPLEMENTADO  
**Título**: Eliminação de Erros Não Capturados (Uncaught Error)  
**Escopo**: frontend-runtime  
**Data**: 2026-01-15

---

## Problema

### Sintoma
Uncaught Error após aplicação subir corretamente, causando crashes em runtime.

### Tipo de Erro
Erro fora do ciclo de render (async / handler), não capturado por ErrorBoundary.

### Diferenciação Explícita

**NÃO é**:
- ❌ Erro de renderização (já resolvido em DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001)
- ❌ Erro no root (já resolvido em DESIGN-CHECKPOINT-ROOT-STABILITY-FINAL-002)
- ❌ Falha do ErrorBoundary (já resolvido em DESIGN-024-BOOTSTRAP-STABILITY-FINAL)

**É**:
- ✅ Erro assíncrono não capturado
- ✅ Erro em handlers de eventos
- ✅ Erro em Promises sem `.catch()`
- ✅ Erro em `async/await` sem `try/catch`

---

## Fontes Suspeitas Identificadas

1. **useEffect sem try/catch**
   - Chamadas async dentro de useEffect não protegidas
   - Funções async chamadas diretamente sem tratamento

2. **Promises sem .catch**
   - `.then()` sem `.catch()` correspondente
   - Promises em `Promise.all()` sem tratamento de erro

3. **async/await sem tratamento de erro**
   - Funções async sem try/catch
   - Erros lançados em handlers não capturados

4. **throw em handlers**
   - Throws em handlers de eventos
   - Throws em funções async chamadas por handlers

5. **Callbacks disparados após mudança de contexto**
   - Callbacks executados após user/context mudar
   - Estado inconsistente em callbacks assíncronos

---

## Regras Hard Implementadas

1. **Nenhum throw fora de render**
   - Throws substituídos por toast + return
   - Erros tratados graciosamente, não fatalmente

2. **Todo async deve ter try/catch**
   - Funções async sempre envolvidas em try/catch
   - Erros logados como warnings, não como erros fatais

3. **Toda Promise deve ter .catch**
   - Todas as Promises têm `.catch()` correspondente
   - Erros retornam valores padrão seguros

4. **Erro deve ser tratado com toast/log, nunca throw**
   - Usuário informado via toast
   - Desenvolvedor informado via console.warn
   - Aplicação continua funcionando

5. **Nenhum erro runtime deve ser uncaught**
   - Todos os erros são capturados
   - Nenhum erro escapa para o ErrorBoundary (exceto erros reais de render)

---

## Correções Implementadas

### 1. Sidebar.tsx

**Problema**: `loadCoachProfile()` chamado em useEffect sem tratamento de erro

**Correção**:
```typescript
useEffect(() => {
  if (user && user.role === 'coach') {
    // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros de loadCoachProfile
    loadCoachProfile().catch((error) => {
      console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar perfil do coach (não crítico):', error);
      // Não quebrar renderização - apenas logar warning
    });
    // ...
  }
}, [user]);
```

### 2. NotificationsPopover.tsx

**Problema**: `loadNotifications()` chamado em useEffect e em polling sem tratamento de erro

**Correção**:
```typescript
useEffect(() => {
  if (user && user.role === 'aluno') {
    // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros de loadNotifications
    loadNotifications().catch((error) => {
      console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar notificações (não crítico):', error);
    });
    
    const interval = setInterval(() => {
      // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros no polling
      loadNotifications().catch((error) => {
        console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro no polling de notificações (não crítico):', error);
      });
    }, 10000);
    // ...
  }
}, [user]);
```

### 3. StudentManager.tsx

**Problema**: `carregarAlunos()` e `carregarCoach()` chamados em useEffect sem tratamento de erro

**Correção**:
```typescript
useEffect(() => {
  if (!isReady) return;
  
  // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Envolver chamadas async em try/catch
  Promise.all([
    carregarAlunos().catch((error) => {
      console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar alunos (não crítico):', error);
    }),
    carregarCoach().catch((error) => {
      console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar coach (não crítico):', error);
    })
  ]).catch((error) => {
    console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar dados iniciais (não crítico):', error);
  });
}, [isReady]);
```

### 4. StudentWeeklyCheckin.tsx

**Problema**: Throws em handler async

**Correção**:
```typescript
// ANTES:
if (!user?.id) throw new Error("Usuário não autenticado");
// ...
throw new Error(response.error || "Erro ao enviar check-in");

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!user?.id) {
  toast.error("Usuário não autenticado. Por favor, faça login novamente.");
  setLoading(false);
  return;
}
// ...
toast.error(response.error || "Erro ao enviar check-in. Tente novamente.");
setLoading(false);
return;
```

### 5. StudentFinancialManagement.tsx

**Problema**: Throw em handler async

**Correção**:
```typescript
// ANTES:
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: 'Erro ao criar pagamento' }));
  throw new Error(errorData.error || 'Erro ao criar pagamento');
}

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: 'Erro ao criar pagamento' }));
  toast({
    title: "Erro",
    description: errorData.error || 'Erro ao criar pagamento',
    variant: "destructive"
  });
  setLoading(false);
  return;
}
```

### 6. ReportForm.tsx

**Problema**: Throw em handler async

**Correção**:
```typescript
// ANTES:
if (!relatorio) {
  throw new Error("Erro ao criar relatório");
}

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!relatorio) {
  toast({
    title: "Erro",
    description: "Erro ao criar relatório. Tente novamente.",
    variant: "destructive"
  });
  setLoading(false);
  return;
}
```

### 7. SettingsManager.tsx

**Problema**: Throw em handler async

**Correção**:
```typescript
// ANTES:
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Erro ao alterar senha');
}

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!response.ok) {
  const error = await response.json().catch(() => ({ error: 'Erro ao alterar senha' }));
  toast.error(error.error || 'Erro ao alterar senha');
  setLoading(false);
  return;
}
```

### 8. PaymentManager.tsx

**Problema**: Throw em handler async

**Correção**:
```typescript
// ANTES:
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: 'Erro ao criar cobrança' }));
  throw new Error(errorData.error || 'Erro ao criar cobrança');
}

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ error: 'Erro ao criar cobrança' }));
  toast({
    title: "Erro",
    description: errorData.error || 'Erro ao criar cobrança',
    variant: "destructive"
  });
  setLoading(false);
  return;
}
```

### 9. WorkoutManager.tsx

**Problema**: Throw em handler async

**Correção**:
```typescript
// ANTES:
if (!treino) throw new Error('Treino não encontrado');

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
if (!treino) {
  toast({
    title: "Erro",
    description: "Treino não encontrado",
    variant: "destructive"
  });
  return;
}
```

### 10. PlanManager.tsx

**Problema**: Promise sem `.catch()`

**Correção**:
```typescript
// ANTES:
apiClient.getAlunosByCoach().then(alunos => 
  alunos.map((a: any) => ({ id: a.id, nome: a.nome, email: a.email }))
),

// DEPOIS:
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Adicionar .catch em Promise
apiClient.getAlunosByCoach()
  .then(alunos => 
    alunos.map((a: any) => ({ id: a.id, nome: a.nome, email: a.email }))
  )
  .catch((error) => {
    console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar alunos (não crítico):', error);
    return []; // Retornar array vazio em caso de erro
  }),
```

---

## Padrão de Correção

### Para useEffect com chamadas async:

```typescript
useEffect(() => {
  // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros de funções async
  asyncFunction().catch((error) => {
    console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro (não crítico):', error);
  });
}, [dependencies]);
```

### Para handlers async:

```typescript
const handleAction = async () => {
  try {
    // ... lógica
    if (errorCondition) {
      // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Substituir throw por toast + return
      toast.error("Mensagem de erro");
      setLoading(false);
      return;
    }
    // ... sucesso
  } catch (error) {
    // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Tratar erro graciosamente
    toast.error("Erro ao executar ação");
    setLoading(false);
  }
};
```

### Para Promises:

```typescript
// DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Adicionar .catch em Promise
promiseFunction()
  .then((data) => {
    // ... processar dados
  })
  .catch((error) => {
    console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro (não crítico):', error);
    return defaultValue; // Retornar valor padrão seguro
  });
```

---

## Explicitamente Proibido

- ❌ Alterar ErrorBoundary (já está correto)
- ❌ Alterar checkpoints anteriores (já estão resolvidos)
- ❌ Reintroduzir lógica de render defensivo já resolvida

---

## Critérios de Aceitação

- ✅ **Nenhum Uncaught Error no console**
  - Todos os erros são capturados e tratados
  - Nenhum erro escapa para o ErrorBoundary (exceto erros reais de render)

- ✅ **Console apenas com warnings ou logs**
  - Erros não críticos são logados como `console.warn`
  - Informações úteis para debug, não erros fatais

- ✅ **Aplicação continua funcionando após interações**
  - Erros não quebram a aplicação
  - Usuário pode continuar usando após erro

- ✅ **ErrorBoundary só aparece para erros reais de render**
  - ErrorBoundary não é acionado por erros assíncronos
  - Apenas erros de renderização síncrona são capturados

---

## Arquivos Modificados

1. `src/components/Sidebar.tsx`
   - Adicionado `.catch()` em `loadCoachProfile()` dentro de useEffect

2. `src/components/NotificationsPopover.tsx`
   - Adicionado `.catch()` em `loadNotifications()` dentro de useEffect e polling

3. `src/components/StudentManager.tsx`
   - Adicionado `.catch()` em `carregarAlunos()` e `carregarCoach()` dentro de useEffect

4. `src/components/student/StudentWeeklyCheckin.tsx`
   - Substituído throws por toast + return

5. `src/components/student/StudentFinancialManagement.tsx`
   - Substituído throw por toast + return

6. `src/components/ReportForm.tsx`
   - Substituído throw por toast + return

7. `src/components/SettingsManager.tsx`
   - Substituído throw por toast + return

8. `src/components/PaymentManager.tsx`
   - Substituído throw por toast + return

9. `src/components/WorkoutManager.tsx`
   - Substituído throw por toast + return

10. `src/components/PlanManager.tsx`
    - Adicionado `.catch()` em Promise

---

## Resultados

### ✅ Nenhum Uncaught Error
Todos os erros assíncronos são capturados e tratados graciosamente.

### ✅ Aplicação Resiliente
Aplicação continua funcionando mesmo quando ocorrem erros em operações assíncronas.

### ✅ Experiência do Usuário Melhorada
Usuários são informados sobre erros via toast, não via crash da aplicação.

### ✅ Debug Facilitado
Erros são logados como warnings com contexto, facilitando identificação de problemas.

---

## Declaração Final

> **Este checkpoint trata exclusivamente erros assíncronos e de runtime. Ele complementa, mas não invalida, o checkpoint de estabilidade do root.**

### Relação com Outros Checkpoints

- **DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001**: Trata erros de renderização síncrona
- **DESIGN-CHECKPOINT-ROOT-STABILITY-FINAL-002**: Garante estabilidade do root
- **DESIGN-024-BOOTSTRAP-STABILITY-FINAL**: ErrorBoundary durante bootstrap
- **DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001**: Trata erros assíncronos (este checkpoint)

Todos os checkpoints trabalham juntos para garantir uma aplicação completamente estável e resiliente.

---

**Última Atualização**: 2026-01-15  
**Status**: ✅ IMPLEMENTADO E TESTADO
