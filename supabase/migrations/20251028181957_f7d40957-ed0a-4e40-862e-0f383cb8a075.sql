-- Adicionar campos de validade e notificação na tabela alunos_treinos
ALTER TABLE public.alunos_treinos
ADD COLUMN data_expiracao DATE,
ADD COLUMN dias_antecedencia_notificacao INTEGER DEFAULT 7,
ADD COLUMN notificacao_expiracao_enviada BOOLEAN DEFAULT FALSE;

-- Criar índice para melhorar performance das consultas de expiração
CREATE INDEX idx_alunos_treinos_data_expiracao ON public.alunos_treinos(data_expiracao) WHERE ativo = true AND data_expiracao IS NOT NULL;