-- Inserir role de coach para o usuário assessoriablackhouse@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('5caf02da-1bb7-4776-9ab7-16124c6a0414', 'coach')
ON CONFLICT (user_id) DO NOTHING;