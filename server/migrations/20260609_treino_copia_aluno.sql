-- Cópia de treino por aluno (template como base, edição individual no portal)
ALTER TABLE public.treinos
  ADD COLUMN IF NOT EXISTS aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_origem_id uuid REFERENCES public.treinos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treinos_aluno_id ON public.treinos(aluno_id) WHERE aluno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treinos_template_origem ON public.treinos(template_origem_id) WHERE template_origem_id IS NOT NULL;

COMMENT ON COLUMN public.treinos.aluno_id IS 'Quando preenchido, ficha exclusiva deste aluno (não aparece na biblioteca global)';
COMMENT ON COLUMN public.treinos.template_origem_id IS 'Treino/template usado como base ao atribuir ao aluno';
