-- ============================================================================
-- INSERTS PARA storage.prefixes
-- Gerado automaticamente a partir de prefixes_rows.csv
-- ============================================================================

INSERT INTO storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at,
    level
) VALUES
(
    gen_random_uuid(),
    'avatars',
    '08246522-e164-453f-8d76-32e236a52ac8',
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    1
),
(
    gen_random_uuid(),
    'avatars',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    1
),
(
    gen_random_uuid(),
    'progress-photos',
    'ecdc6b50-e3ce-40b1-ac90-44f419b7f082',
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    1
)
ON CONFLICT DO NOTHING;

-- Se a tabela não tiver o campo 'level', use esta versão alternativa:
/*
INSERT INTO storage.prefixes (
    id,
    bucket_id,
    prefix,
    created_at,
    updated_at
) VALUES
(
    gen_random_uuid(),
    'avatars',
    '08246522-e164-453f-8d76-32e236a52ac8',
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    '2025-12-08 20:49:11.948787+00'::timestamptz
),
(
    gen_random_uuid(),
    'avatars',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    '2025-12-08 17:13:17.366222+00'::timestamptz
),
(
    gen_random_uuid(),
    'progress-photos',
    'ecdc6b50-e3ce-40b1-ac90-44f419b7f082',
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    '2025-10-24 21:19:16.863192+00'::timestamptz
)
ON CONFLICT DO NOTHING;
*/

-- Verificar se os dados foram inseridos
SELECT COUNT(*) as total_prefixes FROM storage.prefixes;
SELECT bucket_id, COUNT(*) as total FROM storage.prefixes GROUP BY bucket_id;
