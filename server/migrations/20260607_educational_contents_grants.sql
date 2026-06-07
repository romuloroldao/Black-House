-- BH-QA-001: app_user precisa de acesso à biblioteca educativa

GRANT SELECT, INSERT, UPDATE, DELETE ON public.educational_contents TO app_user;
