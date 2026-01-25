-- Atualizar função handle_new_user para criar usuários como 'aluno' por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Novos usuários cadastrados via /auth serão alunos por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno');
  
  RETURN NEW;
END;
$$;