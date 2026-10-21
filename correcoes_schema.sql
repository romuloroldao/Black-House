-- Correções do Schema - Tabela perfil_nutricional
-- Data: 12 de Janeiro de 2026

-- Criar tabela perfil_nutricional
CREATE TABLE IF NOT EXISTS public.perfil_nutricional (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    aluno_id uuid NOT NULL,
    objetivo text,
    restricoes_alimentares text[],
    alergias text[],
    preferencias_alimentares text[],
    meta_calorica_diaria numeric,
    meta_proteina_diaria numeric,
    meta_carboidrato_diaria numeric,
    meta_gordura_diaria numeric,
    observacoes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT perfil_nutricional_pkey PRIMARY KEY (id),
    CONSTRAINT perfil_nutricional_aluno_id_fkey FOREIGN KEY (aluno_id) 
        REFERENCES public.alunos(id) ON DELETE CASCADE
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_perfil_nutricional_aluno_id 
    ON public.perfil_nutricional USING btree (aluno_id);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_perfil_nutricional_updated_at
    BEFORE UPDATE ON public.perfil_nutricional
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.perfil_nutricional IS 'Perfil nutricional dos alunos';
COMMENT ON COLUMN public.perfil_nutricional.aluno_id IS 'Referência ao aluno';
COMMENT ON COLUMN public.perfil_nutricional.objetivo IS 'Objetivo nutricional do aluno';
COMMENT ON COLUMN public.perfil_nutricional.restricoes_alimentares IS 'Array de restrições alimentares';
COMMENT ON COLUMN public.perfil_nutricional.alergias IS 'Array de alergias';
COMMENT ON COLUMN public.perfil_nutricional.preferencias_alimentares IS 'Array de preferências alimentares';
COMMENT ON COLUMN public.perfil_nutricional.meta_calorica_diaria IS 'Meta calórica diária em kcal';
COMMENT ON COLUMN public.perfil_nutricional.meta_proteina_diaria IS 'Meta de proteína diária em gramas';
COMMENT ON COLUMN public.perfil_nutricional.meta_carboidrato_diaria IS 'Meta de carboidrato diária em gramas';
COMMENT ON COLUMN public.perfil_nutricional.meta_gordura_diaria IS 'Meta de gordura diária em gramas';
