-- Criar tabela de feedbacks dos alunos
CREATE TABLE IF NOT EXISTS public.feedbacks_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  feedback text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de fotos dos alunos
CREATE TABLE IF NOT EXISTS public.fotos_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  url text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de relação aluno-treino (treino atual do aluno)
CREATE TABLE IF NOT EXISTS public.alunos_treinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  treino_id uuid NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feedbacks_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_treinos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para feedbacks_alunos
CREATE POLICY "Coaches podem ver feedbacks de seus alunos"
ON public.feedbacks_alunos FOR SELECT
USING (true);

CREATE POLICY "Coaches podem criar feedbacks"
ON public.feedbacks_alunos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Coaches podem atualizar seus feedbacks"
ON public.feedbacks_alunos FOR UPDATE
USING (true);

CREATE POLICY "Coaches podem deletar seus feedbacks"
ON public.feedbacks_alunos FOR DELETE
USING (true);

-- Políticas RLS para fotos_alunos
CREATE POLICY "Coaches podem ver fotos de alunos"
ON public.fotos_alunos FOR SELECT
USING (true);

CREATE POLICY "Coaches podem adicionar fotos"
ON public.fotos_alunos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Coaches podem deletar fotos"
ON public.fotos_alunos FOR DELETE
USING (true);

-- Políticas RLS para alunos_treinos
CREATE POLICY "Coaches podem ver treinos de alunos"
ON public.alunos_treinos FOR SELECT
USING (true);

CREATE POLICY "Coaches podem atribuir treinos"
ON public.alunos_treinos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Coaches podem atualizar treinos de alunos"
ON public.alunos_treinos FOR UPDATE
USING (true);

CREATE POLICY "Coaches podem remover treinos de alunos"
ON public.alunos_treinos FOR DELETE
USING (true);

-- Trigger para atualizar updated_at em feedbacks
CREATE TRIGGER update_feedbacks_alunos_updated_at
BEFORE UPDATE ON public.feedbacks_alunos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();