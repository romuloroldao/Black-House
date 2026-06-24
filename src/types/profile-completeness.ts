export type ProfileFieldKey =
  | "nome"
  | "email"
  | "telefone"
  | "data_nascimento"
  | "sexo"
  | "peso_kg"
  | "altura_cm";

export type ProfileCompletenessStatus = {
  is_complete: boolean;
  missing_fields: ProfileFieldKey[];
  completion_pct: number;
  hard_gate_active: boolean;
  grace_expires_at?: string | null;
  grace_logins?: number;
  grace_logins_max?: number;
  field_labels?: Record<string, string>;
};

export const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "WhatsApp",
  data_nascimento: "Data de nascimento",
  sexo: "Sexo",
  peso_kg: "Peso",
  altura_cm: "Altura",
};

export type BodyMetricsResponse = {
  peso_kg: number | null;
  altura_cm: number | null;
  altura_m: number | null;
  idade_anos: number | null;
  sexo: "M" | "F" | null;
  data_nascimento: string | null;
  tmb_kcal: number | null;
  tmb_calculado_em?: string | null;
  peso_historico?: Array<{
    id: string;
    peso_kg: number;
    registrado_em: string;
    origem: string;
  }>;
  profile_status?: ProfileCompletenessStatus;
};
