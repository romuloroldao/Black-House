export type PlanChangeDominio = "dieta" | "treino";

export type PlanChangeNotice = {
  id: string;
  dominio: PlanChangeDominio;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  change_count: number;
  first_change_at: string;
  last_change_at: string;
  due_at: string;
  dispatched_at: string | null;
  attempts: number;
  last_error: string | null;
  in_app: "pending" | "created" | "read" | "failed" | "skipped";
  email:
    | "pending"
    | "queued"
    | "sent_to_provider"
    | "failed"
    | "skipped_preference"
    | "skipped_no_email"
    | "unknown";
  email_sent_at: string | null;
  email_error: string | null;
  realtime_emitted: boolean;
};

export type NoticeTone = "neutral" | "ok" | "warn" | "error";

export type NoticeSummary = {
  label: string;
  tone: NoticeTone;
  detail: string[];
};

/**
 * Texto para o profissional. Só afirma o que o servidor confirmou:
 * "Aviso no app criado" ≠ "lido"; "e-mail enviado" = aceite pelo servidor de e-mail, não entregue na caixa.
 */
export function summarizePlanChangeNotice(n: PlanChangeNotice): NoticeSummary {
  if (n.status === "pending" || n.status === "processing") {
    return {
      label: n.attempts > 0 ? "Aviso ao aluno: nova tentativa agendada" : "Aviso ao aluno: será enviado em instantes",
      tone: n.attempts > 0 ? "warn" : "neutral",
      detail: n.attempts > 0 && n.last_error ? ["A última tentativa falhou; o sistema tentará de novo."] : [],
    };
  }
  if (n.status === "failed") {
    return {
      label: "Aviso ao aluno: falhou",
      tone: "error",
      detail: ["O aluno não foi avisado. Pode tentar reenviar."],
    };
  }
  if (n.status === "cancelled") {
    return {
      label: "Aviso ao aluno: não enviado",
      tone: "neutral",
      detail: [
        n.last_error === "superseded_by_newer_change"
          ? "Substituído por uma alteração mais recente."
          : "A alteração não afeta o plano que o aluno vê (removida ou não ativa).",
      ],
    };
  }

  const detail: string[] = [];
  if (n.in_app === "read") detail.push("App: aviso lido pelo aluno");
  else if (n.in_app === "created") detail.push("App: aviso disponível no sininho (ainda não lido)");
  else detail.push("App: aviso não criado");

  switch (n.email) {
    case "sent_to_provider":
      detail.push("E-mail: enviado ao servidor de e-mail");
      break;
    case "queued":
      detail.push("E-mail: na fila de envio");
      break;
    case "failed":
      detail.push("E-mail: falhou no envio");
      break;
    case "skipped_preference":
      detail.push("E-mail: não enviado (aluno escolheu só avisos no app)");
      break;
    case "skipped_no_email":
      detail.push("E-mail: não enviado (aluno sem e-mail válido)");
      break;
    default:
      detail.push("E-mail: estado indisponível");
  }

  return {
    label: n.in_app === "read" ? "Aviso ao aluno: lido" : "Aviso ao aluno: enviado",
    tone: n.email === "failed" ? "warn" : "ok",
    detail,
  };
}
