-- ============================================================================
-- INSERTS PARA storage.objects
-- Gerado automaticamente a partir de objects_rows.csv
-- ============================================================================

INSERT INTO storage.objects (
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata,
    path_tokens,
    version,
    owner_id,
    user_metadata,
    level
) VALUES
(
    '29235fee-aac3-4e57-9c8f-d9afa374a04f',
    'progress-photos',
    'ecdc6b50-e3ce-40b1-ac90-44f419b7f082/1761340756025.png',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    '2025-10-24 21:19:16.863192+00'::timestamptz,
    '{"eTag": "\"8d550fbaf4164312420d5af590d66b6f\"", "size": 2296067, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-10-24T21:19:17.000Z", "contentLength": 2296067, "httpStatusCode": 200}'::jsonb,
    ARRAY['ecdc6b50-e3ce-40b1-ac90-44f419b7f082', '1761340756025.png'],
    '4d5393bf-d19a-417e-9dbf-9f14974bfe49',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '{}'::jsonb,
    2
),
(
    '3bb4679b-1c9f-4534-8950-bea25d67d2ec',
    'progress-photos',
    'ecdc6b50-e3ce-40b1-ac90-44f419b7f082/1761676753280.png',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '2025-10-28 18:39:13.806177+00'::timestamptz,
    '2025-10-28 18:39:13.806177+00'::timestamptz,
    '2025-10-28 18:39:13.806177+00'::timestamptz,
    '{"eTag": "\"9713ca20360ca6fc021363c76ce31632\"", "size": 213798, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-10-28T18:39:14.000Z", "contentLength": 213798, "httpStatusCode": 200}'::jsonb,
    ARRAY['ecdc6b50-e3ce-40b1-ac90-44f419b7f082', '1761676753280.png'],
    '47c6c589-acff-4842-98f7-0a8b7676e853',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '{}'::jsonb,
    2
),
(
    'b7e03402-0a5f-4f3e-9ca7-e1b44a1f288b',
    'avatars',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415/avatar.PNG',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    '2025-12-08 17:13:17.366222+00'::timestamptz,
    '{"eTag": "\"51643168bd9491a50e6d8de2927920b1\"", "size": 1008441, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2025-12-08T17:13:18.000Z", "contentLength": 1008441, "httpStatusCode": 200}'::jsonb,
    ARRAY['22a30f4e-c07c-450c-8a6e-1ae2cad4e415', 'avatar.PNG'],
    'a685dabe-ae70-4796-baee-9ff9100c6fd1',
    '22a30f4e-c07c-450c-8a6e-1ae2cad4e415',
    '{}'::jsonb,
    2
),
(
    'b8299b94-da38-4370-ba67-8adcf2061428',
    'avatars',
    '08246522-e164-453f-8d76-32e236a52ac8/avatar.jpg',
    '08246522-e164-453f-8d76-32e236a52ac8',
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    '2025-12-08 20:49:11.948787+00'::timestamptz,
    '{"eTag": "\"579cb86c78a7a27577a143a6e5d80cb0\"", "size": 1724745, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-12-08T20:49:12.000Z", "contentLength": 1724745, "httpStatusCode": 200}'::jsonb,
    ARRAY['08246522-e164-453f-8d76-32e236a52ac8', 'avatar.jpg'],
    '2142223b-9ac3-4eef-b640-90d7da5c4156',
    '08246522-e164-453f-8d76-32e236a52ac8',
    '{}'::jsonb,
    2
)
ON CONFLICT (id) DO NOTHING;

-- Verificar se os dados foram inseridos
SELECT COUNT(*) as total_objects FROM storage.objects;
SELECT bucket_id, COUNT(*) as total FROM storage.objects GROUP BY bucket_id;
