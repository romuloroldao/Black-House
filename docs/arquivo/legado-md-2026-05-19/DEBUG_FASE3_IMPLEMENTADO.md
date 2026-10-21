# ✅ Fase 3 - Debug Definitivo de Repositories - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **INSTRUMENTAÇÃO COMPLETA DE TODOS OS REPOSITORIES**

---

## 🎯 Objetivo

Identificar qual repository está chamando `.query` em objeto undefined através de instrumentação completa com guards e logs detalhados.

---

## ✅ Passos Implementados

### STEP-15: Instrumentação de TODOS os Repositories ✅

**Helper Criado**: `shared/db-guards.js`
- ✅ Função `assertQueryable()` com stack trace completo
- ✅ Erro claro com nome do repository, método e stack
- ✅ Logs detalhados em cada validação

**Repositories Instrumentados**:
- ✅ `StudentRepository` - constructor, create, find
- ✅ `DietRepository` - constructor, create (3 métodos)
- ✅ `AlimentoRepository` - constructor, find (3 métodos), create

**Validações Adicionadas**:
- ✅ Antes de cada uso de `this.query` em todos os métodos
- ✅ Validação no constructor com `assertQueryable`
- ✅ Validação explícita de `this.query` antes de cada chamada

**Status**: ✅ **IMPLEMENTADO**

### STEP-16: Validação de Argumentos no Constructor ✅

**Mudanças**:
- ✅ Log detalhado dos argumentos recebidos
- ✅ Abortar explicitamente se `db/client` for `null` ou `undefined`
- ✅ Erro claro: "StudentRepository recebeu db undefined"

**Implementado em**:
- ✅ `StudentRepository`
- ✅ `DietRepository`
- ✅ `AlimentoRepository`

**Status**: ✅ **IMPLEMENTADO**

**Exemplo de Erro Esperado**:
```
STEP-16: StudentRepository recebeu db undefined
  - poolType: undefined
  - poolIsNull: false
  - poolIsUndefined: true
  - stack: [stack trace completo]
```

### STEP-17: Log de Instanciação com Stack Trace ✅

**Mudanças**:
- ✅ Log no momento do `new Repository()` com stack trace
- ✅ Confirmação se `client` ou `pool` está sendo passado corretamente
- ✅ Stack trace limitado a 6 linhas para legibilidade

**Implementado em**:
- ✅ `StudentRepository`
- ✅ `DietRepository`
- ✅ `AlimentoRepository`

**Status**: ✅ **IMPLEMENTADO**

**Logs Esperados**:
```
STEP-17: StudentRepository sendo instanciado
  - poolType: object
  - poolIsNull: false
  - poolIsUndefined: false
  - hasQuery: true
  - stack: [stack trace mostrando onde foi instanciado]
```

### STEP-18: Bloqueio de Defaults Perigosos ✅

**Mudanças**:
- ✅ Removido fallback tipo `this.db = db || pool`
- ✅ Falha explícita se `db` não existir
- ✅ Erro claro: "Repository: pool.query não é função"

**Implementado em**:
- ✅ `StudentRepository`
- ✅ `DietRepository`
- ✅ `AlimentoRepository`

**Status**: ✅ **IMPLEMENTADO**

**Antes** (perigoso):
```javascript
constructor(pool) {
    if (typeof pool.query === 'function') {
        this.query = pool.query.bind(pool);
    } else {
        this.query = pool.query; // Pode ser undefined!
    }
}
```

**Depois** (seguro):
```javascript
constructor(pool) {
    // Validação explícita
    if (pool === null || pool === undefined) {
        throw new Error('STEP-16: Repository recebeu db undefined');
    }
    
    assertQueryable(pool, 'Repository.db', 'constructor');
    
    if (typeof pool.query === 'function') {
        this.query = pool.query.bind(pool);
    } else {
        throw new Error('STEP-18: Repository: pool.query não é função');
    }
}
```

---

## 🔍 Mudanças Estruturais

### 1. Helper Compartilhado `assertQueryable`

**Localização**: `server/shared/db-guards.js`

**Função**: Validar objetos antes de usar `.query`

**Uso**:
```javascript
const { assertQueryable } = require('../shared/db-guards');

// No constructor
assertQueryable(pool, 'StudentRepository.db', 'constructor');

// Antes de usar this.query
if (!this.query || typeof this.query !== 'function') {
    const error = new Error('STEP-15: StudentRepository.db.query é undefined no create()');
    // ... logs e throw
}
```

**Erro Gerado**:
```
STEP-15: StudentRepository.db é undefined no constructor()
  - repositoryName: StudentRepository.db
  - methodName: constructor
  - objType: undefined
  - stack: [stack trace completo]
```

### 2. Validação em Camadas

**Nível 1 - Constructor**:
- Valida se `pool` não é `null/undefined`
- Valida se `pool.query` é função
- Loga stack trace de instanciação

**Nível 2 - Métodos**:
- Valida se `this.query` existe e é função
- Antes de cada chamada de `this.query`
- Erro específico por método (create/find/update)

### 3. Logs de Instanciação

**Onde**: No constructor de cada repository

**Informações Capturadas**:
- Tipo do argumento recebido
- Se é null/undefined
- Se tem método query
- Stack trace mostrando onde foi instanciado

---

## 📊 Repositories Instrumentados

### StudentRepository
- ✅ Constructor com validação completa
- ✅ `createAluno()` - validação antes de query
- ✅ `findAlunoById()` - validação antes de query

### DietRepository
- ✅ Constructor com validação completa
- ✅ `createDieta()` - validação antes de query
- ✅ `createItensDieta()` - validação antes de query
- ✅ `createFarmacos()` - validação antes de query

### AlimentoRepository
- ✅ Constructor com validação completa
- ✅ `findAlimentoByNomeExato()` - validação antes de query
- ✅ `findAllAlimentos()` - validação antes de query
- ✅ `findAlimentoSimilar()` - validação antes de query (corrigido bug: estava usando `this.pool.query`)
- ✅ `createAlimento()` - validação antes de query

---

## 🎯 Comportamento Esperado em Caso de Erro

### Se `pool` for `undefined` no constructor:
```
STEP-16: StudentRepository recebeu db undefined
  - poolType: undefined
  - poolIsNull: false
  - poolIsUndefined: true
  - stack: [stack trace completo]
```

### Se `pool.query` não for função:
```
STEP-18: StudentRepository: pool.query não é função
  - poolType: object
  - hasQuery: undefined
  - poolKeys: [...]
  - stack: [stack trace completo]
```

### Se `this.query` for `undefined` em um método:
```
STEP-15: StudentRepository.db.query é undefined no create()
  - repositoryName: StudentRepository.db
  - methodName: create
  - queryType: undefined
  - queryIsUndefined: true
  - stack: [stack trace completo]
```

### Se `pool` for `null/undefined` no assertQueryable:
```
STEP-15: StudentRepository.db é undefined no constructor()
  - repositoryName: StudentRepository.db
  - methodName: constructor
  - objType: undefined
  - stack: [stack trace completo]
```

---

## 🔧 Locais de Instanciação Rastreados

### 1. `import.controller.js` (linha 420-422)
```javascript
const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
const studentRepo = new StudentRepository({ query: client.query.bind(client) });
const dietRepo = new DietRepository({ query: client.query.bind(client) });
```

**Stack trace mostrará**: Chamada dentro de `confirmImport()`

### 2. `transaction.manager.js` (linha 45-47)
```javascript
const alimentoRepo = new AlimentoRepository({ query: client.query.bind(client) });
const studentRepo = new StudentRepository({ query: client.query.bind(client) });
const dietRepo = new DietRepository({ query: client.query.bind(client) });
```

**Stack trace mostrará**: Chamada dentro de `createRepositories()`

---

## 🧪 Como Testar

### 1. Testar Importação Real

Ao chamar `/api/import/confirm`, os logs mostrarão:
- ✅ Stack trace de onde cada repository foi instanciado
- ✅ Validação de argumentos no constructor
- ✅ Validação antes de cada uso de `this.query`
- ✅ Ponto exato de falha (se ocorrer)

### 2. Monitorar Logs em Tempo Real

```bash
sudo journalctl -u blackhouse-api -f | grep "STEP-"
```

### 3. Verificar Erros Específicos

```bash
# Erros de constructor
sudo journalctl -u blackhouse-api -n 200 --no-pager | grep -A 10 "STEP-16\|STEP-18"

# Erros em métodos
sudo journalctl -u blackhouse-api -n 200 --no-pager | grep -A 10 "STEP-15.*undefined"

# Logs de instanciação
sudo journalctl -u blackhouse-api -n 200 --no-pager | grep -A 5 "STEP-17"
```

---

## 🎉 Resultado Esperado

**Se erro ocorrer agora**:
- ✅ Mensagem clara indicando QUAL repository tem problema
- ✅ Método específico onde o erro ocorreu (constructor/create/find/update)
- ✅ Stack trace completo mostrando onde foi instanciado
- ✅ Tipo e estado do objeto problemático
- ✅ Confirmação se `client` ou `pool` está sendo passado corretamente

**Exemplo de Erro Esperado**:
```
STEP-15: StudentRepository.db.query é undefined no create()
  - repositoryName: StudentRepository.db
  - methodName: create
  - queryType: undefined
  - queryIsUndefined: true
  - stack: [stack trace completo mostrando:
            - Onde create() foi chamado
            - Onde repository foi instanciado
            - Cadeia completa de chamadas]
```

**Ou**:
```
STEP-16: StudentRepository recebeu db undefined
  - poolType: undefined
  - stack: [stack trace mostrando onde new StudentRepository() foi chamado]
```

---

## ✅ Checklist de Implementação

- [x] STEP-15: Helper `assertQueryable()` criado em `shared/db-guards.js`
- [x] STEP-15: StudentRepository instrumentado (constructor + métodos)
- [x] STEP-15: DietRepository instrumentado (constructor + métodos)
- [x] STEP-15: AlimentoRepository instrumentado (constructor + métodos)
- [x] STEP-16: Validação de argumentos no constructor de todos repositories
- [x] STEP-16: Abortar se db/client não for passado
- [x] STEP-17: Log de stack trace no momento da instanciação
- [x] STEP-17: Confirmação se client ou pool está sendo passado
- [x] STEP-18: Removidos fallbacks perigosos (db || pool)
- [x] STEP-18: Falha explícita se db não existir
- [x] Bug corrigido: AlimentoRepository.findAlimentoSimilar() estava usando `this.pool.query` ao invés de `this.query`
- [x] import.controller.js atualizado para usar helper compartilhado

---

## 🐛 Bug Corrigido

**Arquivo**: `alimento.repository.js`  
**Método**: `findAlimentoSimilar()`  
**Problema**: Estava usando `this.pool.query` ao invés de `this.query`  
**Correção**: Alterado para `this.query` e adicionada validação

---

**Última atualização**: 15 de Janeiro de 2026 - Fase 3 Completa
