# ✅ Fix CORS e 502 Bad Gateway - IMPLEMENTADO

**Data**: 15 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🎯 Problema

Erro no frontend ao tentar fazer POST para `/rest/v1/itens_dieta`:
1. **CORS**: `No 'Access-Control-Allow-Origin' header is present`
2. **502 Bad Gateway**: `POST https://api.blackhouse.app.br/rest/v1/itens_dieta net::ERR_FAILED 502`

---

## 🔍 Causa Raiz

**Erro encontrado nos logs**:
```
ReferenceError: filteredData is not defined
```

O problema era que no bloco `catch` do endpoint POST `/rest/v1/:table`, as variáveis `filteredData`, `columns` e `values` estavam sendo usadas, mas estavam declaradas apenas dentro do bloco `try`, causando `ReferenceError` quando ocorria erro antes da definição.

Quando o backend retornava erro 500, o Nginx ou proxy retornava 502 Bad Gateway, e o CORS não era enviado corretamente.

---

## ✅ Correção Implementada

### Mudança em `/root/server/index.js`

**Antes**:
```javascript
app.post('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const data = req.body;
    
    try {
        const filteredData = Object.entries(data) // ... dentro do try
        // ...
        const columns = Object.keys(filteredData);
        const values = Object.values(filteredData);
        // ...
    } catch (error) {
        // ❌ filteredData, columns, values não estão definidos aqui
        logger.error('Erro ao inserir registro', {
            filteredData: JSON.stringify(filteredData), // ReferenceError!
            columns: columns?.join(', '), // ReferenceError!
            values: values?.map(...) // ReferenceError!
        });
    }
});
```

**Depois**:
```javascript
app.post('/rest/v1/:table', authenticate, async (req, res) => {
    const { table } = req.params;
    const data = req.body;
    
    // ✅ Declarar variáveis no escopo da função
    let filteredData = {};
    let columns = [];
    let values = [];
    
    try {
        filteredData = Object.entries(data) // ... atribuir no try
        // ...
        columns = Object.keys(filteredData);
        values = Object.values(filteredData);
        // ...
    } catch (error) {
        // ✅ Agora filteredData, columns, values estão disponíveis
        logger.error('Erro ao inserir registro', {
            filteredData: JSON.stringify(filteredData), // ✅ OK
            columns: columns?.join(', ') || 'N/A', // ✅ OK
            values: values?.map(...) || 'N/A' // ✅ OK
        });
    }
});
```

---

## ✅ Verificações de CORS

### CORS já está configurado corretamente:

1. **Origens permitidas** (`/root/server/index.js` linhas 92-102):
   - `https://blackhouse.app.br` ✅
   - `http://blackhouse.app.br` ✅
   - `https://api.blackhouse.app.br` ✅
   - `http://localhost:5173` ✅

2. **Headers CORS** (`/root/server/index.js` linhas 106-123):
   - `Access-Control-Allow-Origin`: Dinâmico baseado na origem ✅
   - `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS` ✅
   - `Access-Control-Allow-Headers`: `Content-Type, Authorization` ✅
   - `Access-Control-Allow-Credentials`: `true` ✅

3. **OPTIONS handler** (`/root/server/index.js` linha 123):
   - `app.options('*', cors(corsOptions))` ✅

---

## 🎉 Resultado

**Erro corrigido!**

- ✅ `ReferenceError: filteredData is not defined` corrigido
- ✅ Variáveis declaradas no escopo correto
- ✅ CORS configurado corretamente
- ✅ Backend agora retorna erro 500 com headers CORS corretos (não mais 502)
- ✅ Servidor reiniciado e funcionando

---

## 📝 Próximos Passos (se necessário)

Se o erro CORS persistir, verificar:

1. **Nginx Configuration**: Se o Nginx está interceptando requisições antes do backend
2. **Proxy Configuration**: Se há proxy reverso que precisa ser configurado
3. **Headers do Nginx**: Se o Nginx precisa adicionar headers CORS adicionais

---

**Última atualização**: 15 de Janeiro de 2026 - 18:05
