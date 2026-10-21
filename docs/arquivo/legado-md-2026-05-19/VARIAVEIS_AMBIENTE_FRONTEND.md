# ✅ Variáveis de Ambiente do Frontend - Configuradas

**Data**: 12 de Janeiro de 2026  
**Status**: ✅ **CONFIGURADO**

---

## 📋 Variáveis Configuradas

### Arquivo `.env` (Desenvolvimento)

```env
# API URL para desenvolvimento
VITE_API_URL=http://localhost:3001

# Variáveis Supabase (mantidas temporariamente durante migração)
VITE_SUPABASE_PROJECT_ID="cghzttbggklhuyqxzabq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://cghzttbggklhuyqxzabq.supabase.co"
```

**Uso**: Desenvolvimento local  
**API**: `http://localhost:3001`

---

### Arquivo `.env.production` (Produção)

```env
VITE_API_URL=https://api.blackhouse.app.br
```

**Uso**: Build de produção  
**API**: `https://api.blackhouse.app.br`

---

## 🔧 Como Funciona

### No Código (`src/lib/api-client.ts`)

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

- Em desenvolvimento: usa `VITE_API_URL` do `.env` → `http://localhost:3001`
- Em produção: usa `VITE_API_URL` do `.env.production` → `https://api.blackhouse.app.br`
- Fallback: se não encontrar, usa `http://localhost:3001`

---

## ✅ Verificações

### ✅ Variável no .env
```bash
grep "VITE_API_URL" /root/.env
# VITE_API_URL=http://localhost:3001
```

### ✅ Variável no .env.production
```bash
grep "VITE_API_URL" /root/.env.production
# VITE_API_URL=https://api.blackhouse.app.br
```

### ✅ Cliente de API configurado
- Arquivo: `src/lib/api-client.ts`
- Usa: `import.meta.env.VITE_API_URL`
- Fallback: `http://localhost:3001`

---

## 📝 Notas Importantes

### Variáveis Supabase

As variáveis `VITE_SUPABASE_*` ainda estão no `.env` porque:
- O frontend ainda usa Supabase em muitos lugares
- Serão removidas após a migração completa
- Não causam conflito com `VITE_API_URL`

### Ordem de Prioridade

1. `VITE_API_URL` do arquivo de ambiente atual (`.env` ou `.env.production`)
2. Fallback para `http://localhost:3001` se não encontrar

---

## 🚀 Próximos Passos

1. ✅ Variáveis de ambiente configuradas
2. ⏳ Migrar código do frontend para usar `apiClient`
3. ⏳ Remover variáveis `VITE_SUPABASE_*` após migração completa

---

**Última atualização**: 12 de Janeiro de 2026  
**Status**: ✅ Configuração completa
