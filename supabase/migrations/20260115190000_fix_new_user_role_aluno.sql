-- SECURITY-01: Garantir que todos os novos usuários sejam criados como 'aluno' por padrão
-- Por segurança, todos os usuários são criados como "aluno" e podem ser promovidos a "coach" manualmente

-- Atualizar função handle_new_user para criar usuários como 'aluno' por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- SECURITY-01: Novos usuários são sempre criados como 'aluno' por padrão
  -- Coaches serão promovidos manualmente através do painel administrativo
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Nota: O trigger já deve existir na migração anterior, mas garantimos que está configurado
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_user();

-- Também criar trigger para app_auth.users (nossa tabela de autenticação customizada)
DROP TRIGGER IF EXISTS on_user_created ON app_auth.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON app_auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
