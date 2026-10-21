# ✅ Fase 2 - Debug Estrutural - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **GUARDS E LOGS ESTRUTURAIS IMPLEMENTADOS**

---

## 🎯 Objetivo

Implementar debug estrutural profundo para identificar exatamente qual variável está `undefined` quando ocorre o erro `Cannot read properties of undefined (reading 'query')`.

---

## ✅ Passos Implementados

### STEP-09: Detecção de Shadowing de Variáveis ✅

**Mudanças**:
- ✅ `this.db` renomeado para `this._db` (evita shadowing)
- ✅ Helper `assertQueryable()` criado para validação fail-fast
- ✅ Logs antes de CADA uso de `.query` mostrando o objeto real

**Helper Criado**:
```javascript
function assertQueryable(obj, label, location) {
    // Valida se obj existe e se obj.query é função
    // Lança erro claro indicando label e location
}
```

**Status**: ✅ **IMPLEMENTADO**

### STEP-10: Verificação de Perda de Contexto `this` ✅

**Mudanças**:
- ✅ Verificação explícita: `if (this === undefined || this === null)`
- ✅ Rota ajustada para garantir contexto correto
- ✅ Log de `thisType` e `thisIsUndefined` no início do método

**Status**: ✅ **IMPLEMENTADO**

**Logs Esperados**:
```
STEP-04: confirmImport chamado
  - thisType: object
  - thisIsUndefined: false
  - this_DbType: object
```

### STEP-11: Verificação de Múltiplas Referências de Banco ✅

**Mudanças**:
- ✅ Verificação de `require.cache` para detectar múltiplos imports de `pg`
- ✅ Log de repositórios criados
- ✅ Confirmação de que apenas `this._db` é usado

**Status**: ✅ **IMPLEMENTADO**

**Logs Esperados**:
```
STEP-11: Verificação de referências múltiplas
  - hasPgRequire: false
  - cacheKeys: [...]

STEP-11: Repositórios criados
  - alimentoRepoType: object
  - studentRepoType: object
  - dietRepoType: object
```

### STEP-12: Garantir Escopo do Client de Transação ✅

**Mudanças**:
- ✅ Flag `clientReleased` adicionada
- ✅ Guard antes de cada uso de `client.query`
- ✅ Bloqueio de queries após `release()`
- ✅ Validação no `finally` para evitar double-release

**Status**: ✅ **IMPLEMENTADO**

**Guards Adicionados**:
- Antes de `BEGIN`: `assertQueryable(client, 'client', 'antes de BEGIN')`
- Antes de criar repositórios: `assertQueryable(client, 'client', 'antes de criar repositórios')`
- Antes de `COMMIT`: `assertQueryable(client, 'client', 'antes de COMMIT')`
- Antes de `ROLLBACK`: `assertQueryable(client, 'client', 'antes de ROLLBACK')`

### STEP-13: Validação do Shape de req.body ✅

**Mudanças**:
- ✅ Log completo de `req.body` (JSON stringified, limitado a 500 chars)
- ✅ Validação explícita de `req.body.data` antes de usar
- ✅ Log de chaves de `data` se existir

**Status**: ✅ **IMPLEMENTADO**

**Logs Esperados**:
```
STEP-13: Validando req.body
  - reqBodyStringified: "{...}"
  - hasData: true
  - dataType: object
  - dataKeys: ["aluno", "dieta", ...]
```

### STEP-14: Guards Fail-Fast ✅

**Mudanças**:
- ✅ Helper `assertQueryable()` implementado
- ✅ Usado antes de:
  - `this._db.connect()`
  - `client.query('BEGIN')`
  - Criar repositórios
  - `client.query('COMMIT')`
  - `client.query('ROLLBACK')`

**Status**: ✅ **IMPLEMENTADO**

**Comportamento**:
- Se objeto for `null` ou `undefined`: erro claro com label e location
- Se `obj.query` não for função: erro claro com detalhes do objeto
- Logs detalhados em cada validação

---

## 🔍 Mudanças Estruturais

### 1. Renomeação de `this.db` para `this._db`

**Motivo**: Evitar shadowing de variáveis locais chamadas `db`

**Antes**:
```javascript
this.db = db;
const client = await this.db.connect();
```

**Depois**:
```javascript
this._db = db;
const client = await this._db.connect();
```

### 2. Helper `assertQueryable()`

**Função**: Validar objetos antes de usar `.query`

**Uso**:
```javascript
assertQueryable(this._db, 'this._db', 'antes de connect()');
assertQueryable(client, 'client', 'antes de BEGIN');
```

**Erro Gerado**:
```
STEP-14: client é undefined em antes de BEGIN
```

### 3. Flag `clientReleased`

**Função**: Rastrear estado do client para evitar uso após release

**Uso**:
```javascript
let clientReleased = false;
// ... uso do client ...
client.release();
clientReleased = true;
```

### 4. Validação de Contexto `this`

**Função**: Detectar perda de contexto em métodos async

**Uso**:
```javascript
if (this === undefined || this === null) {
    logger.error('STEP-10: Contexto this perdido');
    return res.status(500).json({ ... });
}
```

---

## 📊 Logs de Inicialização (Confirmados)

```
STEP-01: Configurando Pool PostgreSQL ✅
STEP-02: Pool inicializado com sucesso ✅
STEP-03: Instanciando ImportController ✅
STEP-03: ImportController constructor chamado ✅
STEP-03: ImportController inicializado ✅
STEP-11: Verificação de referências múltiplas ✅
STEP-03: ImportController instanciado com sucesso ✅
```

---

## 🎯 Comportamento Esperado em Caso de Erro

### Se `this._db` for undefined:
```
STEP-14: this._db é undefined em antes de connect()
  - label: this._db
  - location: antes de connect()
  - objType: undefined
```

### Se `client` for undefined após connect:
```
STEP-14: client é undefined em após connect()
  - label: client
  - location: após connect()
  - objType: undefined
```

### Se tentar usar client após release:
```
STEP-12: Tentativa de usar client após release
```

### Se contexto `this` for perdido:
```
STEP-10: Contexto this perdido em confirmImport
```

---

## 🔧 Versão do Controller

**Versão Atual**: `v1.0.0-debug-20260115-phase2`

Logada em cada chamada de `confirmImport` para rastreamento.

---

## ✅ Checklist de Implementação

- [x] STEP-09: Renomeação para `this._db` (evitar shadowing)
- [x] STEP-09: Helper `assertQueryable()` criado
- [x] STEP-10: Verificação de contexto `this`
- [x] STEP-10: Rota ajustada para preservar contexto
- [x] STEP-11: Verificação de múltiplas referências
- [x] STEP-11: Log de repositórios criados
- [x] STEP-12: Flag `clientReleased` implementada
- [x] STEP-12: Guards antes de cada uso de client
- [x] STEP-13: Validação completa de `req.body`
- [x] STEP-14: Guards fail-fast em todos os pontos críticos
- [x] Deploy em produção
- [x] Servidor reiniciado
- [x] Logs confirmados funcionando

---

## 🧪 Como Testar

### 1. Testar Importação Real

Ao chamar `/api/import/confirm`, os logs mostrarão:
- Estado de `this` e `this._db`
- Shape completo de `req.body`
- Validação de cada objeto antes de usar `.query`
- Ponto exato de falha (se ocorrer)

### 2. Monitorar Logs em Tempo Real

```bash
sudo journalctl -u blackhouse-api -f | grep "STEP-"
```

### 3. Verificar Erros Específicos

```bash
sudo journalctl -u blackhouse-api -n 200 --no-pager | grep -A 10 "STEP-14.*undefined"
```

---

## 🎉 Resultado Esperado

**Se erro ocorrer agora**:
- ✅ Mensagem clara indicando QUAL variável é undefined
- ✅ Location exato onde o erro ocorreu
- ✅ Tipo e estado do objeto problemático
- ✅ Stack trace completo

**Exemplo de Erro Esperado**:
```
STEP-14: client é undefined em antes de COMMIT
  - label: client
  - location: antes de COMMIT
  - objType: undefined
```

---

**Última atualização**: 15 de Janeiro de 2026 - 15:34
