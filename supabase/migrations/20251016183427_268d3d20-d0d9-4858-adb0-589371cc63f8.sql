-- Criar função para inserir usuário como admin (primeira conta) ou coach
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Verificar quantos usuários já existem
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  -- Todos os usuários são coaches por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'coach');
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando um novo usuário se registrar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();