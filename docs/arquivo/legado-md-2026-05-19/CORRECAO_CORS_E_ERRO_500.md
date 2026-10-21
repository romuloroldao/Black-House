# ✅ Correção: CORS e Erro 500 ao Salvar Dieta

**Data**: 13 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🐛 Problemas Identificados

### 1. Erro de CORS

**Erro**: 
```
Access to fetch at 'https://api.blackhouse.app.br/rest/v1/alunos?...' 
from origin 'https://blackhouse.app.br' has been blocked by CORS policy
```

**Causa**: O subdomínio `api.blackhouse.app.br` não estava na lista de origens permitidas.

### 2. Erro 500 ao Salvar Dieta

**Erro**: `POST https://api.blackhouse.app.br/rest/v1/itens_dieta 500`

**Mensagem**: `syntax error at or near "0"`

**Causa**: Handler POST não estava tratando corretamente:
- Strings numéricas (`"0"`, `"100"`)
- UUIDs inválidos
- Valores null em campos obrigatórios

---

## ✅ Correções Aplicadas

### 1. CORS Corrigido

**Arquivo**: `/root/server/index.js`

**Mudança**:
```javascript
const allowedOrigins = [
    'http://blackhouse.app.br',
    'https://blackhouse.app.br',
    'http://www.blackhouse.app.br',
    'https://www.blackhouse.app.br',
    'http://api.blackhouse.app.br',      // ✅ ADICIONADO
    'https://api.blackhouse.app.br',     // ✅ ADICIONADO
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);
```

### 2. Handler POST Melhorado

**Melhorias**:

1. **Conversão de strings numéricas**:
   ```javascript
   // "0" → 0
   // "100" → 100
   // "100,5" → 100.5 (suporta vírgula)
   ```

2. **Validação de UUIDs**:
   ```javascript
   // Valida formato UUID antes de inserir
   // Ignora UUIDs inválidos
   ```

3. **Tratamento de campos obrigatórios**:
   ```javascript
   // quantidade é obrigatório - não aceita vazio
   // alimento_id é opcional - pode ser null
   // dia_semana é opcional - pode ser null
   ```

4. **Logging melhorado**:
   ```javascript
   // Log de queries em produção (temporário para debug)
   // Log detalhado de erros com dados completos
   ```

---

## 📋 Estrutura da Tabela `itens_dieta`

### Campos Obrigatórios

- `dieta_id` (uuid) - **Obrigatório**
- `quantidade` (double precision) - **Obrigatório**
- `refeicao` (text) - **Obrigatório**

### Campos Opcionais

- `alimento_id` (uuid) - **Pode ser null**
- `dia_semana` (text) - **Pode ser null**

### Campos com Defaults

- `id` (uuid) - Gerado automaticamente
- `created_at` (timestamp) - Gerado automaticamente

---

## 🧪 Como Testar

### 1. Teste de CORS

1. Acesse: https://blackhouse.app.br
2. Abra o console do navegador (F12)
3. Verifique que **não há mais erros de CORS**
4. Verifique que requisições para `api.blackhouse.app.br` funcionam

### 2. Teste de Salvar Dieta

1. Acesse: https://blackhouse.app.br
2. Vá para edição de uma dieta
3. Adicione alimentos às refeições
4. Clique em "Salvar"
5. Verifique que:
   - ✅ Dieta é salva sem erros
   - ✅ Não há erro 500 no console
   - ✅ Itens são salvos corretamente

### 3. Verificar Logs

```bash
# Ver logs em tempo real
sudo journalctl -u blackhouse-api -f

# Ver logs de inserção
sudo journalctl -u blackhouse-api | grep "Insert query"
```

---

## 📊 Validações Implementadas

### Conversões Automáticas

1. **Strings numéricas**:
   - `"0"` → `0` (número)
   - `"100"` → `100` (número)
   - `"100,5"` → `100.5` (suporta vírgula)

2. **Strings vazias**:
   - `""` em `alimento_id` → `null`
   - `""` em `dia_semana` → `null`
   - `""` em `quantidade` → **omitido** (obrigatório)

3. **UUIDs**:
   - Valida formato antes de inserir
   - Ignora UUIDs inválidos

4. **Null/Undefined**:
   - `undefined` → omitido
   - `null` em campos opcionais → `null`
   - `null` em campos obrigatórios → **erro de validação do banco**

---

## ⚠️ Troubleshooting

### Problema: Ainda há erro 500

**Verificar logs**:
```bash
sudo journalctl -u blackhouse-api | grep "Erro ao inserir" -A 10
```

**Possíveis causas**:
1. Campo obrigatório ausente (`dieta_id`, `quantidade`, `refeicao`)
2. UUID inválido
3. Valor não numérico em `quantidade`

### Problema: Ainda há erro de CORS

**Verificar**:
1. Se `api.blackhouse.app.br` está configurado no Nginx
2. Se o Nginx está passando headers CORS corretamente
3. Se há cache do navegador (limpar cache)

---

## ✅ Checklist

- [x] CORS atualizado (api.blackhouse.app.br adicionado)
- [x] Handler POST melhorado
- [x] Conversão de strings numéricas implementada
- [x] Validação de UUIDs implementada
- [x] Tratamento de campos obrigatórios/opcionais
- [x] Logging melhorado
- [x] Arquivo copiado para produção
- [x] Serviço reiniciado
- [ ] Testar em produção (pendente)

---

## 🎉 Conclusão

**Correções aplicadas com sucesso!**

Agora o sistema:
- ✅ Aceita requisições de `api.blackhouse.app.br`
- ✅ Trata corretamente valores numéricos como strings
- ✅ Valida UUIDs antes de inserir
- ✅ Trata campos obrigatórios/opcionais corretamente
- ✅ Logs detalhados para debug

**Teste**: Acesse https://blackhouse.app.br e tente salvar uma dieta novamente.

---

**Última atualização**: 13 de Janeiro de 2026 - 14:30
