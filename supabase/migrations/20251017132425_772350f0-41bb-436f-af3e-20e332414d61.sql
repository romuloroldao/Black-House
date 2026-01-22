-- Adicionar campo CPF/CNPJ na tabela alunos
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;