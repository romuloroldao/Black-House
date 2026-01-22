-- ============================================================================
-- INSERTS PARA supabase_migrations.schema_migrations
-- Gerado automaticamente a partir de migrations_rows.csv
-- ============================================================================

-- NOTA: Este script assume que a tabela tem a estrutura:
-- id, name, hash, executed_at
-- Se a estrutura for diferente (version, name, statements, inserted_at),
-- ajuste conforme necessário.

INSERT INTO supabase_migrations.schema_migrations (
    id,
    name,
    hash,
    executed_at
) VALUES
(0, 'create-migrations-table', 'e18db593bcde2aca2a408c4d1100f6abba2195df', '2025-08-07 19:44:52.873227'::timestamptz),
(1, 'initialmigration', '6ab16121fbaa08bbd11b712d05f358f9b555d777', '2025-08-07 19:44:52.900711'::timestamptz),
(2, 'storage-schema', '5c7968fd083fcea04050c1b7f6253c9771b99011', '2025-08-07 19:44:52.907594'::timestamptz),
(3, 'pathtoken-column', '2cb1b0004b817b29d5b0a971af16bafeede4b70d', '2025-08-07 19:44:52.972241'::timestamptz),
(4, 'add-migrations-rls', '427c5b63fe1c5937495d9c635c263ee7a5905058', '2025-08-07 19:44:53.059183'::timestamptz),
(5, 'add-size-functions', '79e081a1455b63666c1294a440f8ad4b1e6a7f84', '2025-08-07 19:44:53.063012'::timestamptz),
(6, 'change-column-name-in-get-size', 'f93f62afdf6613ee5e7e815b30d02dc990201044', '2025-08-07 19:44:53.073141'::timestamptz),
(7, 'add-rls-to-buckets', 'e7e7f86adbc51049f341dfe8d30256c1abca17aa', '2025-08-07 19:44:53.077171'::timestamptz),
(8, 'add-public-to-buckets', 'fd670db39ed65f9d08b01db09d6202503ca2bab3', '2025-08-07 19:44:53.080759'::timestamptz),
(9, 'fix-search-function', '3a0af29f42e35a4d101c259ed955b67e1bee6825', '2025-08-07 19:44:53.084096'::timestamptz),
(10, 'search-files-search-function', '68dc14822daad0ffac3746a502234f486182ef6e', '2025-08-07 19:44:53.088522'::timestamptz),
(11, 'add-trigger-to-auto-update-updated_at-column', '7425bdb14366d1739fa8a18c83100636d74dcaa2', '2025-08-07 19:44:53.093046'::timestamptz),
(12, 'add-automatic-avif-detection-flag', '8e92e1266eb29518b6a4c5313ab8f29dd0d08df9', '2025-08-07 19:44:53.103016'::timestamptz),
(13, 'add-bucket-custom-limits', 'cce962054138135cd9a8c4bcd531598684b25e7d', '2025-08-07 19:44:53.106464'::timestamptz),
(14, 'use-bytes-for-max-size', '941c41b346f9802b411f06f30e972ad4744dad27', '2025-08-07 19:44:53.110211'::timestamptz),
(15, 'add-can-insert-object-function', '934146bc38ead475f4ef4b555c524ee5d66799e5', '2025-08-07 19:44:53.144161'::timestamptz),
(16, 'add-version', '76debf38d3fd07dcfc747ca49096457d95b1221b', '2025-08-07 19:44:53.149336'::timestamptz),
(17, 'drop-owner-foreign-key', 'f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101', '2025-08-07 19:44:53.156477'::timestamptz),
(18, 'add_owner_id_column_deprecate_owner', 'e7a511b379110b08e2f214be852c35414749fe66', '2025-08-07 19:44:53.166089'::timestamptz),
(19, 'alter-default-value-objects-id', '02e5e22a78626187e00d173dc45f58fa66a4f043', '2025-08-07 19:44:53.178602'::timestamptz),
(20, 'list-objects-with-delimiter', 'cd694ae708e51ba82bf012bba00caf4f3b6393b7', '2025-08-07 19:44:53.183004'::timestamptz),
(21, 's3-multipart-uploads', '8c804d4a566c40cd1e4cc5b3725a664a9303657f', '2025-08-07 19:44:53.191081'::timestamptz),
(22, 's3-multipart-uploads-big-ints', '9737dc258d2397953c9953d9b86920b8be0cdb73', '2025-08-07 19:44:53.210999'::timestamptz),
(23, 'optimize-search-function', '9d7e604cddc4b56a5422dc68c9313f4a1b6f132c', '2025-08-07 19:44:53.23648'::timestamptz),
(24, 'operation-function', '8312e37c2bf9e76bbe841aa5fda889206d2bf8aa', '2025-08-07 19:44:53.251396'::timestamptz),
(25, 'custom-metadata', 'd974c6057c3db1c1f847afa0e291e6165693b990', '2025-08-07 19:44:53.256079'::timestamptz),
(26, 'objects-prefixes', 'ef3f7871121cdc47a65308e6702519e853422ae2', '2025-08-27 18:16:44.38913'::timestamptz),
(27, 'search-v2', '33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2', '2025-08-27 18:16:44.68558'::timestamptz),
(28, 'object-bucket-name-sorting', 'ba85ec41b62c6a30a3f136788227ee47f311c436', '2025-08-27 18:16:44.712158'::timestamptz),
(29, 'create-prefixes', 'a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b', '2025-08-27 18:16:44.822907'::timestamptz),
(30, 'update-object-levels', '6c6f6cc9430d570f26284a24cf7b210599032db7', '2025-08-27 18:16:44.8969'::timestamptz),
(31, 'objects-level-index', '33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8', '2025-08-27 18:16:44.907302'::timestamptz),
(32, 'backward-compatible-index-on-objects', '2d51eeb437a96868b36fcdfb1ddefdf13bef1647', '2025-08-27 18:16:44.921284'::timestamptz),
(33, 'backward-compatible-index-on-prefixes', 'fe473390e1b8c407434c0e470655945b110507bf', '2025-08-27 18:16:45.896705'::timestamptz),
(34, 'optimize-search-function-v1', '82b0e469a00e8ebce495e29bfa70a0797f7ebd2c', '2025-08-27 18:16:45.899672'::timestamptz),
(35, 'add-insert-trigger-prefixes', '63bb9fd05deb3dc5e9fa66c83e82b152f0caf589', '2025-08-27 18:16:45.91'::timestamptz),
(36, 'optimise-existing-functions', '81cf92eb0c36612865a18016a38496c530443899', '2025-08-27 18:16:45.918004'::timestamptz),
(37, 'add-bucket-name-length-trigger', '3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1', '2025-08-27 18:16:45.933189'::timestamptz),
(38, 'iceberg-catalog-flag-on-buckets', '19a8bd89d0dfa69af7f222a46c726b7c41e462c5', '2025-08-27 18:16:45.942778'::timestamptz),
(39, 'add-search-v2-sort-support', '39cf7d1e6bf515f4b02e41237aba845a7b492853', '2025-10-15 20:36:03.070564'::timestamptz),
(40, 'fix-prefix-race-conditions-optimized', 'fd02297e1c67df25a9fc110bf8c8a9af7fb06d1f', '2025-10-15 20:36:03.115334'::timestamptz),
(41, 'add-object-level-update-trigger', '44c22478bf01744b2129efc480cd2edc9a7d60e9', '2025-10-15 20:36:03.143299'::timestamptz),
(42, 'rollback-prefix-triggers', 'f2ab4f526ab7f979541082992593938c05ee4b47', '2025-10-15 20:36:03.149426'::timestamptz),
(43, 'fix-object-level', 'ab837ad8f1c7d00cc0b7310e989a23388ff29fc6', '2025-10-15 20:36:03.157499'::timestamptz),
(44, 'vector-bucket-type', '99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3', '2025-11-18 17:40:01.589508'::timestamptz),
(45, 'vector-buckets', '049e27196d77a7cb76497a85afae669d8b230953', '2025-11-18 17:40:01.637548'::timestamptz),
(46, 'buckets-objects-grants', 'fedeb96d60fefd8e02ab3ded9fbde05632f84aed', '2025-11-18 17:40:01.742106'::timestamptz),
(47, 'iceberg-table-metadata', '649df56855c24d8b36dd4cc1aeb8251aa9ad42c2', '2025-11-18 17:40:01.753415'::timestamptz),
(48, 'iceberg-catalog-ids', '2666dff93346e5d04e0a878416be1d5fec345d6f', '2025-11-18 17:40:01.763528'::timestamptz),
(49, 'buckets-objects-grants-postgres', '072b1195d0d5a2f888af6b2302a1938dd94b8b3d', '2025-12-22 18:44:52.185166'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- Verificar se os dados foram inseridos
SELECT COUNT(*) as total_migrations FROM supabase_migrations.schema_migrations;
