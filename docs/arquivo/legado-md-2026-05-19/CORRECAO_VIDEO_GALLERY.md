# ✅ Correção: Vídeos Não Aparecem na Lista

**Data**: 12 de Janeiro de 2026  
**Problema**: Vídeo adicionado mas não aparece na lista

---

## 🐛 PROBLEMAS IDENTIFICADOS

### 1. VideoGallery ainda usava Supabase ❌
- Componente `VideoGallery.tsx` ainda usava `supabase.from()` para buscar vídeos
- Não estava usando `apiClient` migrado

### 2. Filtro de coach_id pode estar bloqueando ❌
- Query pode estar filtrando incorretamente por `coach_id`
- Pode não estar retornando vídeos se o filtro falhar

### 3. Método delete não estava funcionando ❌
- Delete ainda usava Supabase

---

## ✅ CORREÇÕES APLICADAS

### 1. Migração Completa para apiClient ✅

**Antes**:
```typescript
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .from('videos')
  .select('*')
  .order('created_at', { ascending: false });
```

**Depois**:
```typescript
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

let query = apiClient
  .from('videos')
  .select('*');

if (user?.id) {
  query = query.eq('coach_id', user.id);
}

const data = await query.order('created_at', { ascending: false });
```

### 2. Tratamento de Erros Melhorado ✅
```typescript
try {
  // ... busca de vídeos
} catch (error) {
  console.error('Erro ao carregar vídeos:', error);
  toast({
    title: "Erro ao carregar vídeos",
    description: error instanceof Error ? error.message : "Não foi possível carregar os vídeos",
    variant: "destructive",
  });
}
```

### 3. Delete Migrado ✅

**Antes**:
```typescript
const { error } = await supabase
  .from('videos')
  .delete()
  .eq('id', videoId);
```

**Depois**:
```typescript
await apiClient
  .from('videos')
  .delete(videoId);
```

### 4. Formatação de Dados Corrigida ✅
```typescript
const videosFormatados = (Array.isArray(data) ? data : []).map(video => ({
  id: video.id,
  title: video.titulo,  // snake_case do banco → camelCase do frontend
  description: video.descricao || '',
  youtubeId: video.youtube_id,
  // ... resto dos campos
}));
```

---

## 📋 ARQUIVOS MODIFICADOS

1. ✅ `/root/src/components/VideoGallery.tsx`
   - Migrado de `supabase` para `apiClient`
   - Adicionado `useAuth` para obter usuário
   - Filtro de `coach_id` condicional
   - Tratamento de erros melhorado
   - Delete migrado

---

## 🔍 VERIFICAÇÕES NECESSÁRIAS

### 1. Verificar se o vídeo foi salvo no banco
```sql
SELECT * FROM public.videos ORDER BY created_at DESC LIMIT 5;
```

### 2. Verificar se o coach_id está correto
```sql
SELECT id, titulo, coach_id, created_at FROM public.videos;
```

### 3. Verificar se o usuário logado tem o mesmo ID
- Verificar no console do navegador o `user.id`
- Comparar com o `coach_id` dos vídeos no banco

---

## 🎯 PRÓXIMOS PASSOS

Se os vídeos ainda não aparecerem:

1. **Verificar dados no banco**: Confirmar que os vídeos foram salvos
2. **Verificar filtro**: Pode ser necessário remover o filtro de `coach_id` temporariamente
3. **Verificar console**: Ver se há erros no console do navegador
4. **Verificar network**: Ver se a requisição está sendo feita e qual resposta está vindo

---

## ✅ RESULTADO ESPERADO

Após as correções:
- ✅ Vídeos devem aparecer na lista após serem adicionados
- ✅ Vídeos devem ser filtrados por `coach_id` do usuário logado
- ✅ Delete deve funcionar corretamente
- ✅ Erros devem ser exibidos em toast notifications

---

**Última atualização**: 12 de Janeiro de 2026
