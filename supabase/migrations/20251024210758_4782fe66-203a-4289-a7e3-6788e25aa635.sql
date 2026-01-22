-- Criar bucket para fotos de progresso dos alunos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- RLS policies para o bucket progress-photos
-- Permitir que alunos façam upload de suas próprias fotos
CREATE POLICY "Alunos podem fazer upload de suas fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.alunos WHERE email = auth.jwt() ->> 'email'
  )
);

-- Permitir que alunos vejam suas próprias fotos
CREATE POLICY "Alunos podem ver suas fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.alunos WHERE email = auth.jwt() ->> 'email'
  )
);

-- Permitir que coaches vejam fotos de seus alunos
CREATE POLICY "Coaches podem ver fotos de seus alunos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.alunos WHERE coach_id = auth.uid()
  )
);

-- Permitir que alunos deletem suas próprias fotos
CREATE POLICY "Alunos podem deletar suas fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'progress-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.alunos WHERE email = auth.jwt() ->> 'email'
  )
);