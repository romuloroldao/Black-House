# ✅ Expansão da API - Suporte a Filtros e Queries Complexas

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **IMPLEMENTADO**

---

## 🎯 O Que Foi Implementado

### 1. Filtros na API REST

A API agora suporta os seguintes operadores de filtro:

#### Operadores Disponíveis
- `eq` - Igual a
- `neq` - Diferente de
- `gt` - Maior que
- `gte` - Maior ou igual a
- `lt` - Menor que
- `lte` - Menor ou igual a
- `like` - LIKE (case-sensitive)
- `ilike` - ILIKE (case-insensitive)
- `in` - Dentro de uma lista
- `is` - IS NULL ou IS NOT NULL

#### Formato de Uso

```
GET /rest/v1/alunos?coach_id.eq=123&nome.ilike=joão&limit=10&order=created_at.desc
```

### 2. Query Builder no Cliente

O `apiClient.from()` agora retorna um query builder com métodos encadeáveis:

```typescript
// Exemplo de uso
const alunos = await apiClient
  .from('alunos')
  .select('id, nome, email')
  .eq('coach_id', userId)
  .ilike('nome', 'joão')
  .order('created_at', { ascending: false })
  .limit(10);
```

---

## 📋 Exemplos de Uso

### Filtro Simples
```typescript
// Buscar alunos de um coach
const alunos = await apiClient
  .from('alunos')
  .eq('coach_id', userId);
```

### Múltiplos Filtros
```typescript
// Buscar alunos ativos de um coach
const alunos = await apiClient
  .from('alunos')
  .eq('coach_id', userId)
  .eq('ativo', true);
```

### Busca com LIKE
```typescript
// Buscar por nome
const alunos = await apiClient
  .from('alunos')
  .ilike('nome', 'joão');
```

### Ordenação e Limite
```typescript
// Buscar últimos 10 alunos ordenados por data
const alunos = await apiClient
  .from('alunos')
  .eq('coach_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);
```

### Filtro IN
```typescript
// Buscar alunos com IDs específicos
const alunos = await apiClient
  .from('alunos')
  .in('id', ['id1', 'id2', 'id3']);
```

### Filtro NULL
```typescript
// Buscar alunos sem email
const alunos = await apiClient
  .from('alunos')
  .is('email', 'null');
```

---

## 🔒 Segurança

### Validação de Nomes
- Nomes de tabelas e colunas são validados com regex
- Apenas caracteres alfanuméricos e underscore são permitidos
- Previne SQL injection

### Parâmetros Preparados
- Todos os valores são passados como parâmetros preparados
- Previne SQL injection

---

## 🧪 Testes

### Teste 1: Filtro EQ
```bash
curl "http://localhost:3001/rest/v1/alunos?coach_id.eq=123" \
  -H "Authorization: Bearer TOKEN"
```

### Teste 2: Múltiplos Filtros
```bash
curl "http://localhost:3001/rest/v1/alunos?coach_id.eq=123&ativo.eq=true" \
  -H "Authorization: Bearer TOKEN"
```

### Teste 3: Ordenação e Limite
```bash
curl "http://localhost:3001/rest/v1/alunos?coach_id.eq=123&order=created_at.desc&limit=10" \
  -H "Authorization: Bearer TOKEN"
```

---

## 📊 Compatibilidade com Supabase

### Métodos Compatíveis

| Supabase | API Própria | Status |
|----------|-------------|--------|
| `.eq()` | `.eq()` | ✅ |
| `.neq()` | `.neq()` | ✅ |
| `.gt()` | `.gt()` | ✅ |
| `.gte()` | `.gte()` | ✅ |
| `.lt()` | `.lt()` | ✅ |
| `.lte()` | `.lte()` | ✅ |
| `.like()` | `.like()` | ✅ |
| `.ilike()` | `.ilike()` | ✅ |
| `.in()` | `.in()` | ✅ |
| `.is()` | `.is()` | ✅ |
| `.order()` | `.order()` | ✅ |
| `.limit()` | `.limit()` | ✅ |
| `.range()` | `.range()` | ✅ |

---

## ⚠️ Limitações Atuais

### Não Implementado (Ainda)
- `.or()` - Operador OR (pode ser adicionado)
- `.and()` - Operador AND explícito (já é padrão)
- Joins - Não suportado (precisa de queries customizadas)
- Agregações - Não suportado (precisa de RPC)

### Soluções Alternativas

#### OR
Para queries OR, use múltiplas requisições ou RPC:
```typescript
// Múltiplas requisições
const [result1, result2] = await Promise.all([
  apiClient.from('alunos').eq('status', 'ativo'),
  apiClient.from('alunos').eq('status', 'pendente')
]);
```

#### Joins
Use RPC ou queries customizadas:
```typescript
const result = await apiClient.rpc('get_alunos_with_treinos', { coach_id: userId });
```

---

## 🚀 Próximos Passos

1. ✅ Filtros básicos implementados
2. ⏳ Adicionar suporte a `.or()`
3. ⏳ Adicionar suporte a joins simples
4. ⏳ Adicionar suporte a agregações básicas
5. ⏳ Otimizar performance de queries complexas

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Funcional e pronto para uso
