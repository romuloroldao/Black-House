-- Primeiro, remover as foreign keys existentes que causam problemas
ALTER TABLE IF EXISTS itens_dieta DROP CONSTRAINT IF EXISTS itens_dieta_dieta_id_fkey;
ALTER TABLE IF EXISTS dietas DROP CONSTRAINT IF EXISTS dietas_aluno_id_fkey;
ALTER TABLE IF EXISTS alunos_treinos DROP CONSTRAINT IF EXISTS alunos_treinos_aluno_id_fkey;
ALTER TABLE IF EXISTS feedbacks_alunos DROP CONSTRAINT IF EXISTS feedbacks_alunos_aluno_id_fkey;
ALTER TABLE IF EXISTS fotos_alunos DROP CONSTRAINT IF EXISTS fotos_alunos_aluno_id_fkey;

-- Adicionar foreign keys com ON DELETE CASCADE para permitir exclusão em cascata
ALTER TABLE dietas
  ADD CONSTRAINT dietas_aluno_id_fkey 
  FOREIGN KEY (aluno_id) 
  REFERENCES alunos(id) 
  ON DELETE CASCADE;

ALTER TABLE itens_dieta
  ADD CONSTRAINT itens_dieta_dieta_id_fkey 
  FOREIGN KEY (dieta_id) 
  REFERENCES dietas(id) 
  ON DELETE CASCADE;

ALTER TABLE alunos_treinos
  ADD CONSTRAINT alunos_treinos_aluno_id_fkey 
  FOREIGN KEY (aluno_id) 
  REFERENCES alunos(id) 
  ON DELETE CASCADE;

ALTER TABLE feedbacks_alunos
  ADD CONSTRAINT feedbacks_alunos_aluno_id_fkey 
  FOREIGN KEY (aluno_id) 
  REFERENCES alunos(id) 
  ON DELETE CASCADE;

ALTER TABLE fotos_alunos
  ADD CONSTRAINT fotos_alunos_aluno_id_fkey 
  FOREIGN KEY (aluno_id) 
  REFERENCES alunos(id) 
  ON DELETE CASCADE;