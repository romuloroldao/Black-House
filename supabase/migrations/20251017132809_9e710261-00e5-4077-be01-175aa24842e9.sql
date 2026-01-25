-- Adicionar campos telefone e plano na tabela alunos
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS plano TEXT;