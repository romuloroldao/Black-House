/** Acesso operacional do aluno (independente do bloqueio financeiro). */

export type AcessoOperacional = "pending" | "active" | "suspended" | "revoked";

export const ACESSO_OPERACIONAL_LABELS: Record<AcessoOperacional, string> = {
  pending: "Pendente",
  active: "Activo",
  suspended: "Suspenso",
  revoked: "Revogado",
};

export function normalizeAcessoOperacional(value: unknown): AcessoOperacional {
  const v = String(value || "pending").toLowerCase();
  if (v === "active" || v === "suspended" || v === "revoked" || v === "pending") {
    return v;
  }
  return "pending";
}

export function acessoOperacionalBadgeClass(acesso: AcessoOperacional): string {
  switch (acesso) {
    case "active":
      return "bg-success/20 text-success border-success/30";
    case "pending":
      return "bg-muted text-muted-foreground border-border";
    case "suspended":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "revoked":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Acções disponíveis a partir do estado actual. */
export function acessoOperacionalActions(
  current: AcessoOperacional,
): Array<{ value: AcessoOperacional; label: string }> {
  switch (current) {
    case "pending":
      return [
        { value: "active", label: "Conceder acesso" },
        { value: "revoked", label: "Revogar acesso" },
      ];
    case "active":
      return [
        { value: "suspended", label: "Suspender acesso" },
        { value: "revoked", label: "Revogar acesso" },
      ];
    case "suspended":
      return [
        { value: "active", label: "Reactivar acesso" },
        { value: "revoked", label: "Revogar acesso" },
      ];
    case "revoked":
      return [{ value: "active", label: "Reactivar acesso" }];
    default:
      return [{ value: "active", label: "Conceder acesso" }];
  }
}
