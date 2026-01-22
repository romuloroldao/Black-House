# 📦 Configuração de Storage Buckets

## Buckets Necessários

O sistema requer os seguintes buckets de storage no Supabase:

### 1. `avatars`
**Descrição:** Fotos de perfil de usuários (coaches e alunos)

**Políticas RLS:**
- ✅ Público pode ler (para exibir avatares)
- ✅ Usuários autenticados podem fazer upload do próprio avatar
- ✅ Usuários podem atualizar/deletar apenas seu próprio avatar

**Estrutura de pastas sugerida:**
```
avatars/
  ├── {user_id}/
  │   └── avatar.{ext}
```

**SQL para criar bucket:**
```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Política: Público pode ler
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Política: Usuários podem fazer upload do próprio avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem atualizar próprio avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem deletar próprio avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### 2. `fotos-alunos`
**Descrição:** Fotos de progresso dos alunos

**Políticas RLS:**
- ✅ Coach pode ver fotos de seus alunos
- ✅ Aluno pode ver suas próprias fotos
- ✅ Coach pode fazer upload de fotos de seus alunos
- ✅ Aluno pode fazer upload de suas próprias fotos

**Estrutura de pastas sugerida:**
```
fotos-alunos/
  ├── {aluno_id}/
  │   ├── {timestamp}_foto1.{ext}
  │   ├── {timestamp}_foto2.{ext}
  │   └── ...
```

**SQL para criar bucket:**
```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-alunos', 'fotos-alunos', false);

-- Política: Coach pode ver fotos de seus alunos
CREATE POLICY "Coaches can view student photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'fotos-alunos'
    AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.coach_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
);

-- Política: Aluno pode ver suas próprias fotos
CREATE POLICY "Students can view own photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'fotos-alunos'
    AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- Política: Coach pode fazer upload de fotos de seus alunos
CREATE POLICY "Coaches can upload student photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'fotos-alunos'
    AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.coach_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
);

-- Política: Aluno pode fazer upload de suas próprias fotos
CREATE POLICY "Students can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'fotos-alunos'
    AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.email = (auth.jwt() ->> 'email')
    )
);

-- Política: Coach pode deletar fotos de seus alunos
CREATE POLICY "Coaches can delete student photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'fotos-alunos'
    AND EXISTS (
        SELECT 1 FROM alunos a
        WHERE a.id::text = (storage.foldername(name))[1]
        AND a.coach_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
);
```

---

### 3. `anexos`
**Descrição:** Anexos de avisos, mensagens e outros documentos

**Políticas RLS:**
- ✅ Coach pode ver anexos de seus avisos/mensagens
- ✅ Aluno pode ver anexos de avisos/mensagens destinados a ele
- ✅ Coach pode fazer upload de anexos
- ✅ Aluno pode fazer upload de anexos em conversas

**Estrutura de pastas sugerida:**
```
anexos/
  ├── avisos/
  │   └── {aviso_id}/
  │       └── {filename}
  ├── mensagens/
  │   └── {mensagem_id}/
  │       └── {filename}
  └── outros/
      └── {tipo}/
          └── {id}/
              └── {filename}
```

**SQL para criar bucket:**
```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', false);

-- Política: Coach pode ver anexos de seus avisos
CREATE POLICY "Coaches can view own attachments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'anexos'
    AND (
        -- Anexos de avisos do coach
        (storage.foldername(name))[1] = 'avisos'
        AND EXISTS (
            SELECT 1 FROM avisos av
            WHERE av.id::text = (storage.foldername(name))[2]
            AND av.coach_id = auth.uid()
        )
        -- Anexos de mensagens do coach
        OR (
            (storage.foldername(name))[1] = 'mensagens'
            AND EXISTS (
                SELECT 1 FROM mensagens m
                JOIN conversas c ON m.conversa_id = c.id
                WHERE m.id::text = (storage.foldername(name))[2]
                AND c.coach_id = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    )
);

-- Política: Aluno pode ver anexos de avisos/mensagens destinados a ele
CREATE POLICY "Students can view relevant attachments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'anexos'
    AND (
        -- Anexos de avisos para o aluno
        (
            (storage.foldername(name))[1] = 'avisos'
            AND EXISTS (
                SELECT 1 FROM avisos_destinatarios ad
                JOIN alunos a ON ad.aluno_id = a.id
                WHERE ad.aviso_id::text = (storage.foldername(name))[2]
                AND a.email = (auth.jwt() ->> 'email')
            )
        )
        -- Anexos de mensagens do aluno
        OR (
            (storage.foldername(name))[1] = 'mensagens'
            AND EXISTS (
                SELECT 1 FROM mensagens m
                JOIN conversas c ON m.conversa_id = c.id
                JOIN alunos a ON c.aluno_id = a.id
                WHERE m.id::text = (storage.foldername(name))[2]
                AND a.email = (auth.jwt() ->> 'email')
            )
        )
    )
);

-- Política: Coach pode fazer upload de anexos
CREATE POLICY "Coaches can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'anexos'
    AND (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('coach', 'admin')
        )
    )
);

-- Política: Aluno pode fazer upload de anexos em conversas
CREATE POLICY "Students can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'anexos'
    AND (storage.foldername(name))[1] = 'mensagens'
    AND EXISTS (
        SELECT 1 FROM mensagens m
        JOIN conversas c ON m.conversa_id = c.id
        JOIN alunos a ON c.aluno_id = a.id
        WHERE m.id::text = (storage.foldername(name))[2]
        AND a.email = (auth.jwt() ->> 'email')
    )
);
```

---

### 4. `videos`
**Descrição:** Thumbnails e arquivos de vídeo (se armazenados localmente)

**Políticas RLS:**
- ✅ Coach pode gerenciar seus próprios vídeos
- ✅ Alunos podem ver vídeos públicos ou de suas turmas
- ✅ Público pode ver vídeos públicos (se aplicável)

**Estrutura de pastas sugerida:**
```
videos/
  ├── {coach_id}/
  │   ├── {video_id}/
  │   │   ├── video.{ext}
  │   │   └── thumbnail.{ext}
  │   └── ...
```

**SQL para criar bucket:**
```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false);

-- Política: Coach pode ver seus próprios vídeos
CREATE POLICY "Coaches can view own videos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'videos'
    AND EXISTS (
        SELECT 1 FROM videos v
        WHERE v.coach_id = auth.uid()
        AND v.id::text = (storage.foldername(name))[2]
    )
    OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
);

-- Política: Alunos podem ver vídeos públicos ou de suas turmas
CREATE POLICY "Students can view accessible videos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'videos'
    AND EXISTS (
        SELECT 1 FROM videos v
        WHERE v.id::text = (storage.foldername(name))[2]
        AND (
            v.visibilidade = 'publico'
            OR (
                v.visibilidade = 'turma'
                AND EXISTS (
                    SELECT 1 FROM turmas_alunos ta
                    JOIN alunos a ON ta.aluno_id = a.id
                    WHERE ta.turma_id = v.turma_id
                    AND a.email = (auth.jwt() ->> 'email')
                )
            )
        )
    )
);

-- Política: Coach pode fazer upload de vídeos
CREATE POLICY "Coaches can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('coach', 'admin')
    )
);

-- Política: Coach pode atualizar/deletar seus vídeos
CREATE POLICY "Coaches can manage own videos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Coaches can delete own videos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Configuração de Tamanhos Máximos

Recomendações de limites por bucket:

| Bucket | Tamanho Máximo por Arquivo | Tamanho Total |
|--------|---------------------------|---------------|
| `avatars` | 5 MB | 50 MB por usuário |
| `fotos-alunos` | 10 MB | 500 MB por aluno |
| `anexos` | 25 MB | 1 GB por coach |
| `videos` | 500 MB | 10 GB por coach |

**SQL para configurar limites (se suportado):**
```sql
-- Nota: Supabase pode não suportar limites por bucket diretamente
-- Considere implementar validação na aplicação
```

---

## Funções Úteis para Storage

### Função para obter URL pública de um arquivo
```sql
CREATE OR REPLACE FUNCTION get_public_url(bucket_name TEXT, file_path TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN format(
        '%s/storage/v1/object/public/%s/%s',
        current_setting('app.settings.supabase_url'),
        bucket_name,
        file_path
    );
END;
$$ LANGUAGE plpgsql;
```

### Função para deletar arquivo do storage
```sql
CREATE OR REPLACE FUNCTION delete_storage_file(bucket_name TEXT, file_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Esta função precisaria ser implementada via Edge Function
    -- ou usando a API do Supabase Storage
    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

---

## Exemplo de Uso no Código

### Upload de Avatar (JavaScript/TypeScript)
```typescript
import { supabase } from './supabase';

async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/avatar.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      upsert: true,
      contentType: file.type
    });
  
  if (error) throw error;
  
  // Atualizar URL no perfil
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);
  
  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  
  return publicUrl;
}
```

### Upload de Foto de Progresso
```typescript
async function uploadProgressPhoto(alunoId: string, file: File) {
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop();
  const fileName = `${alunoId}/${timestamp}_foto.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('fotos-alunos')
    .upload(fileName, file);
  
  if (error) throw error;
  
  // Obter URL privada (não pública)
  const { data: signedUrl } = await supabase.storage
    .from('fotos-alunos')
    .createSignedUrl(fileName, 3600); // Válido por 1 hora
  
  // Salvar referência no banco
  await supabase
    .from('fotos_alunos')
    .insert({
      aluno_id: alunoId,
      url: signedUrl.signedUrl,
      descricao: 'Foto de progresso'
    });
  
  return signedUrl.signedUrl;
}
```

---

## Notas Importantes

1. **Segurança**: Sempre valide tipos de arquivo e tamanhos no backend
2. **Performance**: Considere usar CDN para arquivos públicos
3. **Backup**: Configure backups automáticos dos buckets importantes
4. **Limpeza**: Implemente rotina para deletar arquivos órfãos
5. **Compressão**: Considere comprimir imagens antes do upload

---

## Rotina de Limpeza de Arquivos Órfãos

```sql
-- Função para encontrar arquivos órfãos (sem referência no banco)
CREATE OR REPLACE FUNCTION find_orphan_files(bucket_name TEXT)
RETURNS TABLE(file_path TEXT) AS $$
BEGIN
    -- Esta função precisaria acessar a lista de arquivos do storage
    -- e comparar com as referências no banco de dados
    -- Implementação depende da API disponível
    RETURN;
END;
$$ LANGUAGE plpgsql;
```

---

## Checklist de Configuração

- [ ] Criar bucket `avatars` com políticas RLS
- [ ] Criar bucket `fotos-alunos` com políticas RLS
- [ ] Criar bucket `anexos` com políticas RLS
- [ ] Criar bucket `videos` com políticas RLS
- [ ] Configurar limites de tamanho (se aplicável)
- [ ] Testar upload de arquivos
- [ ] Testar download de arquivos
- [ ] Validar políticas RLS
- [ ] Configurar backups
- [ ] Documentar URLs e endpoints
