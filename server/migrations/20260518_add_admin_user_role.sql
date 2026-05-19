-- Super admin: papel admin para gestão global (todos coaches/alunos)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- romulo.roldao@gmail.com = super admin do sistema
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM app_auth.users WHERE LOWER(email) = 'romulo.roldao@gmail.com' LIMIT 1
);
