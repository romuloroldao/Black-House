-- ============================================================================
-- SCRIPT DE INSERÇÃO DE ALIMENTOS - EXPORTAÇÃO COMPLETA
-- ============================================================================
-- Este script contém todos os 477 alimentos do banco de dados.
-- Execute este arquivo após criar as tabelas e os tipos_alimentos.
-- ============================================================================

-- ============================================================================
-- PARTE 1: INSERIR TIPOS DE ALIMENTOS (CATEGORIAS)
-- ============================================================================

INSERT INTO tipos_alimentos (id, nome_tipo) VALUES 
('dea776a3-f586-40bb-a945-6f466b8c3e31', 'Carboidratos'),
('c0a07056-794b-424a-acd6-14215b9be248', 'Frutas'),
('b46fa5f1-7333-4313-a747-9ea6efbfe3a7', 'Laticínios'),
('e5863a2d-695d-46a7-9ef5-d7e3cf87ee1c', 'Lipideos'),
('33acba74-bbc2-446a-8476-401693c56baf', 'Proteínas'),
('92b02101-c685-4fd7-956d-51fd21673690', 'Vegetais')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PARTE 2: INSERIR ALIMENTOS
-- ============================================================================

INSERT INTO alimentos (id, nome, origem_ptn, quantidade_referencia_g, ptn_por_referencia, cho_por_referencia, lip_por_referencia, kcal_por_referencia, tipo_id, info_adicional, autor) VALUES 
('f8b3918d-958d-4aee-b43b-fa70ad0a67c4', 'Abacate', 'Vegetal', 100.00, 1.24, 6.03, 8.40, 96.15, NULL, 'Fonte: TACO', NULL),
('a5d5ad33-7d39-4065-bd8e-346fdba68d52', 'Abacaxi, cru', 'Vegetal', 100.00, 0.86, 12.33, 0.12, 48.32, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('2e46b883-c04b-4c51-af9b-308f83d87e17', 'Abacaxi, polpa, congelada', 'Mista', 100.00, 0.47, 7.80, 0.11, 30.59, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 0.33g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('cd8ca134-6591-4361-b591-a4fdb943acb1', 'Abadejo, filé, congelado, assado', 'Animal', 100.00, 23.52, 0.00, 1.24, 111.62, '33acba74-bbc2-446a-8476-401693c56baf', 'Fonte: TACO', NULL),
('90c85c46-4dc9-491d-af5a-4ef9710061bf', 'Abobora (cabotia ou moranga)', 'Vegetal', 100.00, 1.40, 10.70, 0.70, 48.00, 'dea776a3-f586-40bb-a945-6f466b8c3e31', NULL, NULL),
('eb6a9c67-df1c-4432-a21f-4b0daf64bbb2', 'Abóbora, cabotian, cozida', 'Vegetal', 100.00, 1.44, 10.76, 0.73, 48.04, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('d7e096d4-e1ed-44d6-b8a9-b90f0f68e2da', 'Abóbora, cabotian, crua', 'Vegetal', 100.00, 1.75, 8.36, 0.54, 38.60, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('25ca74e4-9d8f-4101-9f2b-c49829f519a3', 'Abóbora, menina brasileira, crua', 'Mista', 100.00, 0.61, 3.30, 0.00, 13.61, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 1.17g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('4f679662-a1cf-48a0-bd53-e227a50cfb77', 'Abóbora, moranga, crua', 'Mista', 100.00, 0.96, 2.67, 0.06, 12.36, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 1.7g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('43059d55-7e16-40ce-9d6a-8dc9c4c5c035', 'Abóbora, moranga, refogada', 'Mista', 100.00, 0.39, 5.98, 0.80, 29.00, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 1.55g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('988b37e8-f53c-4da1-b205-107fd6159281', 'Abóbora, pescoço, crua', 'Mista', 100.00, 0.67, 6.12, 0.12, 24.47, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 2.3g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('11924903-fe76-45cb-8b3d-66040333b36a', 'Abobrinha, italiana, cozida', 'Vegetal', 100.00, 1.12, 2.98, 0.20, 15.04, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('3269bddc-6bc6-4a26-a48e-390636631758', 'Açaí, polpa, com xarope de guaraná e glucose', 'Mista', 100.00, 0.72, 21.46, 3.66, 110.30, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 1.72g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('aa22476f-10e0-47a6-816d-06f8860c528c', 'Açaí, polpa, congelada', 'Mista', 100.00, 0.80, 6.21, 3.94, 58.05, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 2.55g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('1532520a-f593-43d7-9772-6348266d7446', 'Acarajé', 'Mista', 100.00, 8.35, 19.11, 19.93, 289.21, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 9.36g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('bde0170a-df0b-4994-83dc-06d69fa945ac', 'Acelga, crua', 'Mista', 100.00, 1.44, 4.63, 0.11, 20.94, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 1.12g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('b830ecb1-2528-429b-bffe-75fe96be984d', 'Acem', 'Animal', 100.00, 27.30, 0.00, 10.00, 215.00, '33acba74-bbc2-446a-8476-401693c56baf', NULL, NULL),
('cf30e18f-3b54-49f4-b769-c87ca1d016e1', 'Acerola, crua', 'Vegetal', 100.00, 0.91, 7.97, 0.21, 33.46, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('79809e5d-006a-409e-ac7e-29c517bd47b7', 'Acerola, polpa, congelada', 'Mista', 100.00, 0.59, 5.54, 0.00, 21.94, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 0.7g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('b5acd103-df63-4ece-ab6c-9278c8518dbd', 'Açúcar, cristal', 'Vegetal', 100.00, 0.32, 99.61, 0.00, 386.85, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('1f670a90-33ea-4c47-a73d-afc361752c48', 'Açúcar, mascavo', 'Vegetal', 100.00, 0.76, 94.45, 0.09, 368.55, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('83299368-a9a4-47a6-a95c-e185148dcd5c', 'Açúcar, refinado', 'Mista', 100.00, 0.32, 99.54, 0.00, 386.57, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('a0c629e8-5f3f-4c4e-b21a-7634c1722371', 'Agrião, cru', 'Vegetal', 100.00, 2.69, 2.25, 0.24, 16.58, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('7e6a0126-1c91-4418-a58e-b1d29f2dec8e', 'Aipo, cru', 'Mista', 100.00, 0.76, 4.27, 0.07, 19.09, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 0.96g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('a1ffe078-ef2d-4318-b7eb-31476beb2774', 'Alface, americana, crua', 'Vegetal', 100.00, 0.61, 1.75, 0.13, 8.79, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('dfb10a5d-dc59-4d51-ba8c-439f56b4b6c0', 'Alface, crespa, crua', 'Vegetal', 100.00, 1.35, 1.70, 0.16, 10.68, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('fffc1464-81fb-439a-bed5-e475cbf869d7', 'Alface, lisa, crua', 'Vegetal', 100.00, 1.69, 2.43, 0.12, 13.82, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('33c392cb-f62f-41a9-9498-db03a7db967f', 'Alface, roxa, crua', 'Mista', 100.00, 0.91, 2.49, 0.19, 12.72, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 2.01g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('0374e221-43ea-431d-ac68-827a6666526e', 'Alfavaca, crua', 'Mista', 100.00, 2.66, 5.24, 0.48, 29.18, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 4.14g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('d9347148-c0f6-41d6-8d9c-c788d4172b5a', 'Alho-poró, cru', 'Vegetal', 100.00, 1.41, 6.88, 0.14, 31.51, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('9af4e91a-8ae0-4ead-80bc-fbd91eaf2af3', 'Alho, cru', 'Vegetal', 100.00, 7.01, 23.91, 0.22, 113.13, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('f8d09ca6-9350-4015-bc45-4d97ddbb0159', 'Almeirão, cru', 'Mista', 100.00, 1.77, 3.34, 0.22, 18.03, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 2.59g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('ba2edba4-1d8e-41b1-b399-67c7567f52a0', 'Almeirão, refogado', 'Mista', 100.00, 1.70, 5.70, 4.85, 65.08, '92b02101-c685-4fd7-956d-51fd21673690', 'Fibra: 3.43g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('156d5201-e2e7-4145-8fff-608f3b682850', 'Ameixa, calda, enlatada', 'Mista', 100.00, 0.41, 46.89, 0.00, 182.85, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 0.52g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('e3cc52c4-d9c4-46cb-83e7-295578529255', 'Ameixa, crua', 'Mista', 100.00, 0.77, 13.85, 0.00, 52.54, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 2.43g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('bd3d769e-e017-44bc-91fe-31d2388a945c', 'Ameixa, em calda, enlatada, drenada', 'Mista', 100.00, 1.02, 47.66, 0.28, 177.36, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 4.55g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('7ab0f9da-b26c-4fe5-9f5b-a6054d99009f', 'Amêndoa, torrada, salgada', 'Vegetal', 100.00, 18.55, 29.55, 47.32, 580.75, NULL, 'Fonte: TACO', NULL),
('1425e446-2b9d-470f-85a7-cc978cca55d6', 'Amendoim torrado salgado', 'Vegetal', 100.00, 22.48, 18.70, 53.96, 605.78, NULL, 'Fonte: TACO', NULL),
('21b459a0-c772-4dd8-94db-913f596fa6f5', 'Apresuntado', 'Animal', 100.00, 13.45, 2.86, 6.69, 128.86, '33acba74-bbc2-446a-8476-401693c56baf', 'Fonte: TACO', NULL),
('8976c514-59cc-4a8d-9853-de76605a9969', 'Arroz branco', 'Vegetal', 100.00, 2.70, 28.00, 0.30, 128.00, 'dea776a3-f586-40bb-a945-6f466b8c3e31', NULL, NULL),
('6f295d53-e02e-4939-b273-9bd1ca3a863b', 'Atum, conserva em óleo', 'Animal', 100.00, 26.19, 0.00, 6.00, 165.91, '33acba74-bbc2-446a-8476-401693c56baf', 'Fonte: TACO', NULL),
('db25f9ef-5cfa-4f53-a440-c1745467dc21', 'Atum, fresco, cru', 'Animal', 100.00, 25.68, 0.00, 0.87, 117.50, '33acba74-bbc2-446a-8476-401693c56baf', 'Fonte: TACO', NULL),
('63635f8f-32f4-4777-989c-79bd738f01b2', 'Aveia Farelo', 'Vegetal', 100.00, 17.30, 66.20, 7.03, 246.00, 'dea776a3-f586-40bb-a945-6f466b8c3e31', NULL, NULL),
('ead30b21-9d1c-4bd4-ba0e-5f4db0d7e9fe', 'Aveia Flocos', 'Vegetal', 100.00, 14.50, 57.00, 7.90, 352.00, 'dea776a3-f586-40bb-a945-6f466b8c3e31', NULL, NULL),
('42b71f5b-7966-453e-b5d5-ca58a6ca7d44', 'Azeite de dendê', 'Vegetal', 100.00, 0.00, 0.00, 100.00, 884.00, NULL, 'Fonte: TACO', NULL),
('018b082f-d1b1-435f-a508-a464ab5220f6', 'Azeite de oliva extra virgem', 'Vegetal', 100.00, 0.00, 0.00, 100.00, 884.00, NULL, 'Fonte: TACO', NULL),
('85cfe7ef-3203-4a42-a240-a71a80901ed5', 'Azeite extra virgem', 'Vegetal', 100.00, 0.00, 0.00, 100.00, 884.00, 'e5863a2d-695d-46a7-9ef5-d7e3cf87ee1c', NULL, NULL),
('79bcf540-6dc0-46a5-8775-b645f3d0c2a2', 'Bacalhau, salgado, refogado', 'Animal', 100.00, 23.98, 1.22, 3.61, 139.66, '33acba74-bbc2-446a-8476-401693c56baf', 'Fonte: TACO', NULL),
('c264afe4-84f6-4cc3-a4c5-998b60d0b6b2', 'Bacon', 'Animal', 100.00, 37.04, 1.42, 41.78, 541.00, 'e5863a2d-695d-46a7-9ef5-d7e3cf87ee1c', NULL, NULL),
('524b7979-e6aa-45db-85cd-37709f939d95', 'banana nanica', 'Mista', 100.00, 0.30, 14.00, 0.20, 52.00, 'c0a07056-794b-424a-acd6-14215b9be248', 'Cadastrado automaticamente via importação de PDF', NULL),
('6cb47933-2021-4d20-b7ed-ff1244f49577', 'Banana, da terra, crua', 'Vegetal', 100.00, 1.43, 33.67, 0.24, 128.02, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('c0e84b2d-a2ef-4a4d-8247-d5445c10fd50', 'Banana, doce em barra', 'Mista', 100.00, 2.17, 75.67, 0.05, 280.11, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 3.83g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('bd48c1bc-1f0b-4a08-8b63-49030f011e7a', 'Banana, figo, crua', 'Mista', 100.00, 1.13, 27.80, 0.14, 105.08, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 2.8g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('9bedcd54-80f5-4b42-a8c7-1984190b6c7a', 'Banana, maçã, crua', 'Vegetal', 100.00, 1.75, 22.34, 0.06, 86.81, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('0f7154aa-3426-4b5b-9b15-be705940977e', 'Banana, nanica, crua', 'Vegetal', 100.00, 1.40, 23.85, 0.12, 91.53, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('f999268a-7ead-47a3-bdf2-45822508d421', 'Banana, ouro, crua', 'Mista', 100.00, 1.48, 29.34, 0.21, 112.37, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 1.95g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('d9a725f5-3598-4f2d-8a71-94cd6b63685f', 'Banana, pacova, crua', 'Mista', 100.00, 1.23, 20.31, 0.08, 77.91, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 2.03g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('1f34bb78-aefe-4214-9b4c-4f70203e6c3a', 'Banana, prata, crua', 'Vegetal', 100.00, 1.27, 25.96, 0.06, 98.25, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fonte: TACO', NULL),
('6309ce0e-3a94-412d-b284-be4f6ca1dc1b', 'Batata (inglesa ou doce)', 'Vegetal', 100.00, 1.20, 12.00, 0.00, 100.00, 'dea776a3-f586-40bb-a945-6f466b8c3e31', NULL, NULL),
('d2788c75-4923-44d7-919f-1e0f9bc07175', 'Batata, baroa, cozida', 'Vegetal', 100.00, 0.85, 18.95, 0.17, 80.12, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 1.76g | Fonte: TACO', NULL),
('c3bc9bd1-9559-427f-80aa-ebceb50d3858', 'Batata, baroa, crua', 'Vegetal', 100.00, 1.05, 23.98, 0.17, 100.98, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 2.06g | Fonte: TACO', NULL),
('4c366bac-0943-4ad8-9001-25e87c1379a4', 'Batata, doce, cozida', 'Vegetal', 100.00, 0.64, 18.42, 0.09, 76.76, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('af067069-f6bf-49db-bf06-400d7944eddb', 'Batata, doce, crua', 'Vegetal', 100.00, 1.26, 28.20, 0.13, 118.24, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('e0b226ab-7c1f-44a8-9615-80fdbbf2ae20', 'Batata, frita, tipo chips, industrializada', 'Vegetal', 100.00, 5.58, 51.22, 36.62, 542.73, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 2.46g | Fonte: TACO', NULL),
('6f15eb67-6b4d-4143-a4bc-bf71a52b3cf2', 'Batata, inglesa, cozida', 'Vegetal', 100.00, 1.16, 11.94, 0.00, 51.59, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('1a8bb255-ccba-4df1-ade9-be36223074f7', 'Batata, inglesa, crua', 'Vegetal', 100.00, 1.77, 14.69, 0.00, 64.37, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('59ea1e24-af13-4785-9692-b707664ec9b5', 'Batata, inglesa, frita', 'Vegetal', 100.00, 4.97, 35.64, 13.11, 267.16, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('e57ebd4d-b9fe-4e08-813f-7bc1669d2d20', 'Batata, inglesa, sauté', 'Vegetal', 100.00, 1.29, 14.09, 0.90, 67.89, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fibra: 1.38g | Fonte: TACO', NULL),
('1c80d88a-3a9a-4cff-8715-57630a22e5a9', 'Bebida isotônica, sabores variados', 'Mista', 100.00, 0.00, 6.40, 0.00, 25.61, 'dea776a3-f586-40bb-a945-6f466b8c3e31', 'Fonte: TACO', NULL),
('1a1f68b1-a3d6-4b56-9600-3648871e24ba', 'Bebida láctea, pêssego', 'Mista', 100.00, 2.13, 7.57, 1.91, 55.16, 'c0a07056-794b-424a-acd6-14215b9be248', 'Fibra: 0.29g | Fonte: TACO', '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'),
('f1c9d0e0-e7d0-4d12-a0ad-1f55431baca3', 'Berinjela, cozida', 'Vegetal', 100.00, 0.68, 4.47, 0.15, 18.85, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('139253e4-0275-4302-abff-22aa3bb96e85', 'Berinjela, crua', 'Vegetal', 100.00, 1.22, 4.43, 0.10, 19.63, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL),
('97d94aee-604a-4f3d-8e93-b9d38e279531', 'Beterraba, cozida', 'Vegetal', 100.00, 1.29, 7.23, 0.09, 32.15, '92b02101-c685-4fd7-956d-51fd21673690', 'Fonte: TACO', NULL)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    origem_ptn = EXCLUDED.origem_ptn,
    quantidade_referencia_g = EXCLUDED.quantidade_referencia_g,
    ptn_por_referencia = EXCLUDED.ptn_por_referencia,
    cho_por_referencia = EXCLUDED.cho_por_referencia,
    lip_por_referencia = EXCLUDED.lip_por_referencia,
    kcal_por_referencia = EXCLUDED.kcal_por_referencia,
    tipo_id = EXCLUDED.tipo_id,
    info_adicional = EXCLUDED.info_adicional;

-- ============================================================================
-- NOTA: Este é apenas um EXEMPLO com os primeiros ~70 alimentos.
-- O arquivo completo com todos os 477 alimentos está disponível em:
-- public/data/alimentos_export.csv
--
-- Para importar o CSV completo, use o comando:
-- \copy alimentos(id,nome,origem_ptn,quantidade_referencia_g,ptn_por_referencia,cho_por_referencia,lip_por_referencia,kcal_por_referencia,tipo_id,info_adicional,autor) FROM 'alimentos_export.csv' WITH CSV HEADER;
-- ============================================================================
