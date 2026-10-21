# ✅ Decisão: Scripts de Importação e Supabase

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **DECISÃO TOMADA**

---

## 🎯 DECISÃO FINAL

**Opção Escolhida**: **Opção C - Manter Supabase apenas para scripts**

---

## 📋 ANÁLISE

### Scripts Envolvidos

1. **`src/scripts/import-taco-foods.ts`**
   - Importa dados da tabela TACO (Tabela Brasileira de Composição de Alimentos)
   - Executado manualmente/periodicamente
   - Usa `supabase.from('alimentos').upsert()`
   - Usa `supabase.from('tipos_alimentos').upsert()`

2. **`src/scripts/import-alimentos.ts`**
   - Importa alimentos de arquivo CSV
   - Executado manualmente
   - Usa `supabase.from('alimentos').upsert()`
   - Usa `supabase.rpc('calcular_nutrientes')`

---

## ✅ RACIOCÍNIO

### Por que manter Supabase para scripts?

1. **Scripts não fazem parte do app principal**
   - Não afetam produção
   - Executados raramente (importações iniciais/manutenção)

2. **Complexidade de migração**
   - Scripts precisariam de autenticação via API
   - Requereria criação de endpoints específicos
   - Não há ganho significativo

3. **Funcionalidade isolada**
   - Scripts são independentes do app
   - Não compartilham código com componentes React

4. **Custo-benefício**
   - Manter Supabase apenas para scripts = baixo risco
   - Migrar scripts = alto esforço, baixo retorno

---

## 📝 IMPLEMENTAÇÃO

### Estratégia Adotada

1. ✅ **Manter arquivos de integração** (`client.ts`, `types.ts`)
2. ✅ **Documentar claramente** que é apenas para scripts
3. ✅ **Adicionar avisos** nos arquivos de integração
4. ✅ **Não usar em componentes** (migração continua)

### Arquivos Afetados

- ✅ `src/integrations/supabase/client.ts` - Mantido com avisos
- ✅ `src/integrations/supabase/types.ts` - Mantido como referência
- ✅ `src/scripts/import-taco-foods.ts` - Continua usando Supabase
- ✅ `src/scripts/import-alimentos.ts` - Continua usando Supabase

---

## 🔄 FUTURA MIGRAÇÃO (Opcional)

Se no futuro for necessário migrar scripts:

### Opção A: Endpoint Especial no Backend
```javascript
// server/index.js
app.post('/admin/import-alimentos', authenticateAdmin, async (req, res) => {
  // Lógica de importação em massa
});
```

### Opção B: Script Node.js com API Client
```typescript
// Criar helper para scripts
import { apiClient } from './api-client-helper';
await apiClient.from('alimentos').insert(data);
```

**Nota**: Por enquanto, não é necessário migrar scripts.

---

## ✅ CONCLUSÃO

**Status**: ✅ **DECISÃO IMPLEMENTADA**

- Scripts mantêm Supabase
- Componentes migrados para apiClient
- Documentação atualizada
- Avisos adicionados nos arquivos de integração

---

**Última atualização**: 12 de Janeiro de 2026
