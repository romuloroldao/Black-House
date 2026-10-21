export type AlunoPortalStatusCode =
  | "active"
  | "pending_email"
  | "match_available"
  | "no_access";

export type EmailMatchCandidate = {
  user_id: string;
  email: string;
  email_confirmed_at: string | null;
};

export type AlunoPortalStatus = {
  status: AlunoPortalStatusCode;
  aluno_id: string;
  aluno_nome: string | null;
  aluno_email: string;
  is_technical_import_email: boolean;
  user_id: string | null;
  credential_email: string | null;
  email_confirmed_at: string | null;
  email_match_candidate: EmailMatchCandidate | null;
  last_checkin_at: string | null;
  last_import_at: string | null;
  acesso_operacional?: "pending" | "active" | "suspended" | "revoked";
  acesso_operacional_em?: string | null;
  acesso_operacional_por?: string | null;
  acesso_operacional_nota?: string | null;
  hints: string[];
};
