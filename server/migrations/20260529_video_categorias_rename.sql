-- Renomear e consolidar categorias de vídeos (galeria coach/aluno)
-- Ordem importa: Técnica → Técnica para Exercícios antes de Força → Técnica

UPDATE public.videos SET categoria = 'Técnica para Exercícios' WHERE categoria = 'Técnica';

UPDATE public.videos SET categoria = 'Técnica' WHERE categoria = 'Força';

UPDATE public.videos SET categoria = 'Funcional' WHERE categoria IN ('Mobilidade', 'Motivacional');

UPDATE public.videos SET categoria = 'Saúde' WHERE categoria = 'Reabilitação';
