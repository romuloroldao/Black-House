-- ============================================================================
-- INSERTS PARA storage.buckets
-- Gerado automaticamente a partir de buckets_rows.csv
-- ============================================================================

INSERT INTO storage.buckets (
    id,
    name,
    owner,
    created_at,
    updated_at,
    public,
    avif_autodetection,
    file_size_limit,
    allowed_mime_types,
    owner_id,
    type
) VALUES
(
    'avatars',
    'avatars',
    NULL,
    '2025-12-05 17:03:51.810846+00'::timestamptz,
    '2025-12-05 17:03:51.810846+00'::timestamptz,
    true,
    false,
    NULL,
    ARRAY[]::text[],
    NULL,
    'STANDARD'
),
(
    'progress-photos',
    'progress-photos',
    NULL,
    '2025-10-24 21:07:54.478244+00'::timestamptz,
    '2025-10-24 21:07:54.478244+00'::timestamptz,
    true,
    false,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    NULL,
    'STANDARD'
)
ON CONFLICT (id) DO NOTHING;

-- Verificar se os dados foram inseridos
SELECT COUNT(*) as total_buckets FROM storage.buckets;
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets;
