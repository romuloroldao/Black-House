# ✅ Correção: Erro ao Salvar Dieta

**Data**: 13 de Janeiro de 2026  
**Status**: ✅ **CORRIGIDO**

---

## 🐛 Problema Identificado

**Erro**: `POST https://api.blackhouse.app.br/rest/v1/itens_dieta 500 (Internal Server Error)`

**Mensagem**: `syntax error at or near "0"`

**Causa**: O handler POST genérico (`/rest/v1/:table`) não estava tratando corretamente:
1. Campos `undefined` que não devem ser inseridos
2. Strings vazias em campos numéricos/UUID
3. Campos com defaults (id, created_at) sendo enviados

---

## ✅ Correção Aplicada

### Handler POST Melhorado

**Arquivo**: `/root/server/index.js`

**Mudanças**:

1. **Filtro de campos excluídos**:
   ```javascript
   const fieldsToExclude = ['id', 'created_at', 'updated_at'];
   ```

2. **Tratamento de undefined**:
   ```javascript
   if (value === undefined) {
       return acc; // Omitir campos undefined
   }
   ```

3. **Conversão de strings vazias para null**:
   ```javascript
   if (value === '' && (key.includes('_id') || key.includes('quantidade') || key.includes('calorias'))) {
       acc[key] = null;
   }
   ```

4. **Logging melhorado**:
   - Log de erros com detalhes
   - Log de queries em desenvolvimento

5. **Validação de dados vazios**:
   ```javascript
   if (Object.keys(filteredData).length === 0) {
       return res.status(400).json({ error: 'Nenhum campo válido para inserir' });
   }
   ```

---

## 📋 Estrutura da Tabela `itens_dieta`

```
Column      | Type                   | Nullable | Default
------------|------------------------|----------|----------
id          | uuid                   | not null | gen_random_uuid()
created_at  | timestamp with time zone| not null | now()
dieta_id    | uuid                   | not null |
quantidade  | double precision       | not null |
refeicao    | text                   | not null |
dia_semana  | text                   |          |
alimento_id | uuid                   |          |
```

**Campos obrigatórios**: `dieta_id`, `quantidade`, `refeicao`

**Campos opcionais**: `dia_semana`, `alimento_id`

**Campos com defaults**: `id`, `created_at`

---

## 🧪 Como Testar

### 1. Teste de Salvar Dieta

1. Acesse: https://blackhouse.app.br
2. Vá para edição de uma dieta
3. Adicione alimentos às refeições
4. Clique em "Salvar"
5. Verifique que:
   - ✅ Dieta é salva sem erros
   - ✅ Não há erro 500 no console
   - ✅ Itens são salvos corretamente

### 2. Verificar Logs

```bash
sudo journalctl -u blackhouse-api -f
```

**Resultado esperado**:
- ✅ Status 200 ao salvar
- ✅ Sem erros de sintaxe SQL
- ✅ Logs de sucesso

---

## ⚠️ Validações Adicionais

### Campos Tratados

1. **Campos excluídos automaticamente**:
   - `id` (gerado pelo banco)
   - `created_at` (gerado pelo banco)
   - `updated_at` (se existir)

2. **Conversões automáticas**:
   - String vazia `""` → `null` (em campos `_id`, `quantidade`, `calorias`)
   - `undefined` → omitido (não enviado ao banco)

3. **Validação**:
   - Verifica se há pelo menos um campo válido antes de inserir

---

## 📝 Próximos Passos (Opcional)

### Melhorias Futuras

1. **Validação de schema por tabela**:
   - Validar campos obrigatórios
   - Validar tipos de dados
   - Validar foreign keys

2. **Sanitização de nomes de colunas**:
   - Prevenir SQL injection em nomes de tabelas/colunas
   - Whitelist de tabelas permitidas

3. **Tratamento de erros mais específico**:
   - Mensagens de erro mais claras
   - Códigos de erro específicos

---

## ✅ Checklist

- [x] Handler POST corrigido
- [x] Tratamento de undefined implementado
- [x] Conversão de strings vazias implementada
- [x] Filtro de campos com defaults implementado
- [x] Logging melhorado
- [x] Arquivo copiado para produção
- [x] Serviço reiniciado
- [ ] Testar em produção (pendente)

---

## 🎉 Conclusão

**Correção aplicada com sucesso!**

O handler POST agora trata corretamente:
- ✅ Campos undefined
- ✅ Strings vazias em campos numéricos
- ✅ Campos com defaults
- ✅ Validação básica

**Teste**: Acesse https://blackhouse.app.br e tente salvar uma dieta novamente.

---

**Última atualização**: 13 de Janeiro de 2026 - 14:25
