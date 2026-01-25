-- Associar alunos existentes ao coach atual
UPDATE alunos 
SET coach_id = '22a30f4e-c07c-450c-8a6e-1ae2cad4e415'
WHERE coach_id IS NULL;