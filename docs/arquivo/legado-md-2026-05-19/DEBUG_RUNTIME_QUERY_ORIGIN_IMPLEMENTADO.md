# ✅ DEBUG Runtime Query Origin - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **INSTRUMENTAÇÃO COMPLETA IMPLEMENTADA**

---

## 🎯 Objetivo

Identificar a origem exata do erro `Cannot read properties of undefined (reading 'query')` agora que a infraestrutura está limpa e sob PM2.

---

## ✅ Fases Implementadas

### RUNTIME-01: Interceptar TODAS as chamadas .query ✅

**Helper Criado**: `server/shared/query-interceptor.js`

**Funcionalidades**:
- ✅ Wrapper global para `pool.query` e `client.query`
- ✅ Log de stack trace completo antes de cada execução
- ✅ Log de identidade do objeto (this, constructor.name)
- ✅ Contador de chamadas (callId único)
- ✅ Log de sucesso/erro após execução
- ✅ Util.inspect completo do contexto

**Instrumentação**:
- ✅ Pool instrumentado na criação (server/index.js)
- ✅ Client instrumentado após connect() (import.controller.js)

**Status**: ✅ **IMPLEMENTADO**

**Logs Gerados**:
```
RUNTIME-01: [QUERY-1234567890-1] Interceptando chamada .query
  - callId: QUERY-1234567890-1
  - contextType: Pool/Client
  - contextConstructor: Pool/Client
  - stack: [stack trace completo]
  - timestamp: ISO timestamp
```

### RUNTIME-02: Mapear objetos de banco em runtime ✅

**Logs Adicionados**:
- ✅ Antes de criar ImportController
- ✅ Após criar ImportController
- ✅ Antes de connect()
- ✅ Após connect()
- ✅ Antes de criar repositórios
- ✅ Após criar repositórios

**Informações Capturadas**:
- ✅ `typeof` de todos os objetos
- ✅ `constructor.name` de todos os objetos
- ✅ `Object.keys()` dos objetos
- ✅ `util.inspect()` com depth 3
- ✅ Comparação de identidade (pool vs client)

**Status**: ✅ **IMPLEMENTADO**

**Logs Gerados**:
```
RUNTIME-02: Mapeando objetos de banco
  - thisType: object
  - this_DbType: object
  - this_DbConstructor: Pool
  - clientType: object
  - clientConstructor: Client
  - clientKeys: [...]
  - clientInspect: [dump completo]
```

### RUNTIME-03: Detectar instâncias criadas fora da transação ✅

**Verificações Implementadas**:
- ✅ Comparação de identidade: `alimentoRepo.query === client.query`
- ✅ Verificação se todos os repositórios usam o mesmo client
- ✅ Log antes de criar repositórios com dump do client
- ✅ Log após criar repositórios comparando queries

**Status**: ✅ **IMPLEMENTADO**

**Logs Gerados**:
```
RUNTIME-02: Estado antes de criar repositórios
  - clientType: object
  - clientConstructor: Client
  - clientHasQuery: true
  - clientQueryType: function
  - clientInspect: [dump completo]

RUNTIME-02: Repositórios criados - mapeamento completo
  - alimentoRepoQueryEqual: true/false
  - studentRepoQueryEqual: true/false
  - dietRepoQueryEqual: true/false
```

### RUNTIME-04: Validar assinatura de métodos ✅

**Validações Implementadas**:
- ✅ Verificação de `this` no início de `confirmImport`
- ✅ Log de tipo e construtor de `this`
- ✅ Verificação se `this._db` existe
- ✅ Log de stack trace da chamada
- ✅ Verificação se método foi chamado corretamente

**Status**: ✅ **IMPLEMENTADO**

**Logs Gerados**:
```
RUNTIME-04: Validação de assinatura de método confirmImport
  - thisType: object
  - thisIsUndefined: false
  - thisConstructor: ImportController
  - thisHas_Db: true
  - this_DbType: object
  - callStack: [stack trace]
```

### RUNTIME-05: Teste forçado de falha controlada ✅

**Implementação**:
- ✅ Verificação ANTES do primeiro uso de query
- ✅ Dump completo com `util.inspect()` se `this._db` for undefined
- ✅ Erro explícito com todas as informações
- ✅ Stack trace completo

**Status**: ✅ **IMPLEMENTADO**

**Comportamento**:
Se `this._db` for undefined/null, o erro será:
```
RUNTIME-05: DUMP COMPLETO - this._db é undefined/null
  - thisType: object
  - thisConstructor: ImportController
  - thisKeys: [...]
  - thisInspect: [dump completo de this]
  - stack: [stack trace]
```

---

## 📊 Instrumentação Completa

### 1. Query Interceptor

**Arquivo**: `server/shared/query-interceptor.js`

**Funções**:
- `wrapQuery()`: Wrapper que intercepta e loga cada chamada
- `instrumentQueryable()`: Instrumenta objetos pool/client

**Uso**:
```javascript
const { instrumentQueryable } = require('./shared/query-interceptor');
instrumentQueryable(pool, 'pool');
instrumentQueryable(client, 'client-da-transacao');
```

### 2. Logs de Mapeamento

**Localizações**:
1. **server/index.js** (linha ~191):
   - Antes de criar ImportController
   - Após criar ImportController

2. **import.controller.js** (confirmImport):
   - Validação de assinatura (início)
   - Antes de connect()
   - Após connect()
   - Antes de criar repositórios
   - Após criar repositórios

### 3. Teste Forçado de Falha

**Localização**: `import.controller.js` (linha ~360)

**Comportamento**:
- Se `this._db` for undefined, erro é lançado imediatamente
- Dump completo de `this` é logado
- Stack trace completo é capturado

---

## 🔍 O Que os Logs Revelarão

### Se `this._db` for undefined:
```
RUNTIME-05: DUMP COMPLETO - this._db é undefined/null
  - thisInspect: [dump completo mostrando que _db não existe]
```

### Se `client.query` for undefined:
```
RUNTIME-01: [QUERY-xxx] Interceptando chamada .query
  - contextHasQuery: false
  - contextType: Client
  - stack: [mostra onde query foi chamado]
```

### Se repositório usar query incorreta:
```
RUNTIME-02: Repositórios criados
  - studentRepoQueryEqual: false  // <-- Problema identificado
```

### Se método for chamado incorretamente:
```
RUNTIME-04: Validação de assinatura
  - thisIsUndefined: true  // <-- Problema identificado
```

---

## 🧪 Como Usar

### 1. Reiniciar Servidor
```bash
pm2 restart blackhouse-api
```

### 2. Monitorar Logs
```bash
pm2 logs blackhouse-api -f | grep RUNTIME
```

### 3. Executar Endpoint
Chamar `/api/import/confirm` e observar logs.

### 4. Filtrar Logs Específicos
```bash
# Todas as chamadas .query
pm2 logs blackhouse-api | grep "RUNTIME-01"

# Mapeamento de objetos
pm2 logs blackhouse-api | grep "RUNTIME-02"

# Validação de assinatura
pm2 logs blackhouse-api | grep "RUNTIME-04"

# Teste forçado
pm2 logs blackhouse-api | grep "RUNTIME-05"
```

---

## 📋 Checklist de Implementação

- [x] RUNTIME-01: Query interceptor criado
- [x] RUNTIME-01: Pool instrumentado
- [x] RUNTIME-01: Client instrumentado
- [x] RUNTIME-02: Logs de mapeamento antes de criar ImportController
- [x] RUNTIME-02: Logs de mapeamento após criar ImportController
- [x] RUNTIME-02: Logs de mapeamento antes/depois de connect()
- [x] RUNTIME-02: Logs de mapeamento antes/depois de criar repositórios
- [x] RUNTIME-03: Comparação de identidade de queries
- [x] RUNTIME-04: Validação de assinatura de método
- [x] RUNTIME-05: Teste forçado de falha com dump completo

---

## 🎯 Resultado Esperado

**Quando o erro ocorrer, os logs mostrarão**:

1. **Onde**: Stack trace completo da chamada .query
2. **O quê**: Objeto que está undefined (pool, client, this._db)
3. **Por quê**: Mapeamento completo mostra cadeia de objetos
4. **Como corrigir**: Identidade dos objetos revela origem

**Exemplo de Erro Esperado**:
```
RUNTIME-01: [QUERY-xxx] Interceptando chamada .query
  - contextHasQuery: false
  - contextType: undefined
  - stack: [mostra StudentRepository.createAluno]
  
RUNTIME-02: Repositórios criados
  - studentRepoQueryEqual: false
  - studentRepoHasQuery: false
```

Isso revelará exatamente qual objeto está undefined e onde.

---

**Última atualização**: 15 de Janeiro de 2026 - 16:20
