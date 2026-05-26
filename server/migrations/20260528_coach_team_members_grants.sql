-- GRANT para app_user ler/escrever equipa (resolveCoachScope, inbox check-in, agenda)

GRANT SELECT, INSERT, UPDATE ON public.coach_team_members TO app_user;
