-- Create a function to get emails of users with coach role
CREATE OR REPLACE FUNCTION public.get_coach_emails()
RETURNS TABLE(email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email::text
  FROM auth.users au
  INNER JOIN public.user_roles ur ON ur.user_id = au.id
  WHERE ur.role = 'coach';
$$;