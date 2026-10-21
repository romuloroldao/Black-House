-- ============================================================================
-- MIGRAÇÃO: VPS-NATIVE-ARCH-ALUNOS-COACH-001
-- ============================================================================
-- Aplicar: Tornar linked_user_id obrigatório e único
-- Garantir que alunos sempre pertencem a um coach
-- ============================================================================

-- IMPORTANTE: Execute como superuser ou owner da tabela alunos

-- 1. Vincular alunos existentes que não têm linked_user_id
-- (se houver correspondência por email)
UPDATE public.alunos a
SET linked_user_id = u.id
FROM app_auth.users u
WHERE a.email IS NOT NULL 
  AND a.email != ''
  AND a.email = u.email
  AND a.linked_user_id IS NULL;

-- 2. Remover constraint UNIQUE existente se houver
ALTER TABLE public.alunos 
DROP CONSTRAINT IF EXISTS alunos_linked_user_id_unique;

-- 3. Criar constraint UNIQUE em linked_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_linked_user_id_unique 
ON public.alunos(linked_user_id)
WHERE linked_user_id IS NOT NULL;

-- 4. Tornar linked_user_id NOT NULL
-- NOTA: Isso falhará se houver alunos sem linked_user_id
-- Execute o UPDATE acima primeiro para vincular todos os alunos
ALTER TABLE public.alunos 
ALTER COLUMN linked_user_id SET NOT NULL;

-- 5. Tornar coach_id NOT NULL (aluno sempre pertence a um coach)
-- NOTA: Isso falhará se houver alunos sem coach_id
-- Verifique se todos os alunos têm coach_id antes de executar
ALTER TABLE public.alunos 
ALTER COLUMN coach_id SET NOT NULL;

-- 6. Comentário atualizado
COMMENT ON COLUMN public.alunos.linked_user_id IS 
'ID do usuário vinculado (app_auth.users.id). OBRIGATÓRIO e ÚNICO. Um usuário só pode estar vinculado a um aluno. Este campo é a única fonte de verdade para determinar vínculo.';

COMMENT ON COLUMN public.alunos.coach_id IS 
'ID do coach responsável pelo aluno. OBRIGATÓRIO. Aluno sempre pertence a um coach.';

-- Verificação final
SELECT 
    COUNT(*) as total_alunos,
    COUNT(linked_user_id) as alunos_com_linked_user_id,
    COUNT(coach_id) as alunos_com_coach_id,
    COUNT(*) - COUNT(linked_user_id) as alunos_sem_linked_user_id,
    COUNT(*) - COUNT(coach_id) as alunos_sem_coach_id
FROM public.alunos;
