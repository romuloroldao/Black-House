-- Corrigir policy de visualização de vídeos para alunos
-- Remover policy antiga
DROP POLICY IF EXISTS "Alunos podem ver vídeos do coach" ON videos;

-- Criar nova policy com os valores corretos de visibilidade
CREATE POLICY "Alunos podem ver vídeos do coach" 
ON videos 
FOR SELECT 
USING (
  -- Coach pode ver seus próprios vídeos
  (auth.uid() = coach_id) 
  OR 
  -- Alunos podem ver vídeos se:
  (
    -- O coach_id corresponde ao coach do aluno
    coach_id IN (
      SELECT alunos.coach_id
      FROM alunos
      WHERE alunos.email = (auth.jwt() ->> 'email'::text)
    )
    AND 
    -- E a visibilidade permite
    (
      visibilidade = 'everyone'  -- Público/Todos
      OR visibilidade = 'active-students'  -- Alunos Ativos
      OR visibilidade = 'inactive-students'  -- Alunos Inativos
      OR visibilidade = 'guests'  -- Convidados
      OR visibilidade = 'alunos'  -- Valor legado
      OR visibilidade = 'todos'  -- Valor legado
    )
  )
);