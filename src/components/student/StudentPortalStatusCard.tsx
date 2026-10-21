import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
  UserX,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { API_CONTRACT } from "@/contracts/api-contract";
import type { AlunoPortalStatus } from "@/types/aluno-portal-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ACESSO_OPERACIONAL_LABELS,
  acessoOperacionalActions,
  acessoOperacionalBadgeClass,
  normalizeAcessoOperacional,
  type AcessoOperacional,
} from "@/lib/aluno-acesso-operacional";
import { useConfirm } from "@/contexts/ConfirmContext";

type StudentPortalStatusCardProps = {
  alunoId: string;
  refreshKey?: number;
  onLinked?: () => void;
};

const statusConfig: Record<
  AlunoPortalStatus["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }
> = {
  active: { label: "Credencial vinculada", variant: "default", icon: CheckCircle2 },
  pending_email: { label: "Aguarda confirmação de email", variant: "secondary", icon: Mail },
  match_available: { label: "Cadastro encontrado — pode vincular", variant: "outline", icon: Link2 },
  no_access: { label: "Sem credencial vinculada", variant: "destructive", icon: UserX },
};

export default function StudentPortalStatusCard({
  alunoId,
  refreshKey = 0,
  onLinked,
}: StudentPortalStatusCardProps) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const [status, setStatus] = useState<AlunoPortalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [updatingAcesso, setUpdatingAcesso] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiClient.getAlunoPortalStatusSafe(alunoId);
    if (!result.success) {
      setStatus(null);
      toast.error(result.error || "Não foi possível carregar o estado do portal.");
    } else {
      setStatus(result.data ?? null);
    }
    setLoading(false);
  }, [alunoId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleQuickLink = async () => {
    const candidate = status?.email_match_candidate;
    if (!candidate?.user_id || !candidate.email_confirmed_at) return;

    setLinking(true);
    try {
      const result = await apiClient.requestSafe<{ message?: string }>("/api/alunos/link-user", {
        method: "POST",
        body: JSON.stringify({
          importedAlunoId: alunoId,
          userIdToLink: candidate.user_id,
        }),
      });
      if (!result.success) {
        throw new Error(result.error || "Não foi possível vincular o cadastro.");
      }
      toast.success("Cadastro vinculado ao portal!");
      onLinked?.();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao vincular");
    } finally {
      setLinking(false);
    }
  };

  const handleAcesso = async (next: AcessoOperacional) => {
    const label = ACESSO_OPERACIONAL_LABELS[next];
    const destructive = next === "revoked" || next === "suspended";
    const ok = await confirm({
      title: `${label}?`,
      description: destructive
        ? "O aluno deixará de aceder ao portal. Os dados (dietas, check-ins, histórico) NÃO serão apagados."
        : `Confirmar alteração do acesso para «${label}».`,
      confirmLabel: label,
      destructive,
    });
    if (!ok) return;

    setUpdatingAcesso(true);
    try {
      const result = await apiClient.requestSafe<{ message?: string }>(
        API_CONTRACT.alunos.acesso(alunoId),
        {
          method: "PATCH",
          body: JSON.stringify({ acesso_operacional: next }),
        },
      );
      if (!result.success) {
        throw new Error(result.error || "Falha ao actualizar acesso");
      }
      toast.success(result.data?.message || "Acesso actualizado.");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao actualizar acesso");
    } finally {
      setUpdatingAcesso(false);
    }
  };

  const cfg = status ? statusConfig[status.status] : null;
  const StatusIcon = cfg?.icon ?? ShieldAlert;
  const acesso = normalizeAcessoOperacional(status?.acesso_operacional);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Estado do portal</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Credencial, vínculo e acesso operacional controlado pelo coach.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Actualizar estado do portal"
          onClick={() => void load()}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "motion-safe:animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            A verificar vínculo…
          </div>
        ) : !status ? (
          <p className="text-sm text-muted-foreground">Estado indisponível.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusIcon className="h-4 w-4 text-primary" />
              <Badge variant={cfg?.variant ?? "outline"}>{cfg?.label}</Badge>
              <Badge variant="outline" className={acessoOperacionalBadgeClass(acesso)}>
                Acesso: {ACESSO_OPERACIONAL_LABELS[acesso]}
              </Badge>
              {status.is_technical_import_email ? (
                <Badge variant="outline" className="student-badge-sm">
                  Email técnico (import)
                </Badge>
              ) : null}
            </div>

            {status.acesso_operacional_em ? (
              <p className="text-xs text-muted-foreground">
                Última alteração de acesso:{" "}
                {format(new Date(status.acesso_operacional_em), "dd MMM yyyy HH:mm", {
                  locale: ptBR,
                })}
              </p>
            ) : null}

            {status.credential_email && status.status !== "no_access" ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Credencial: </span>
                <span className="font-medium">{status.credential_email}</span>
              </p>
            ) : null}

            {status.email_match_candidate && status.status === "match_available" ? (
              <p className="text-sm text-muted-foreground">
                Cadastro:{" "}
                <span className="font-medium text-foreground">
                  {status.email_match_candidate.email}
                </span>
                {status.email_match_candidate.email_confirmed_at
                  ? " · email confirmado"
                  : " · email ainda não confirmado"}
              </p>
            ) : null}

            <ul className="space-y-1 text-xs text-muted-foreground">
              {status.hints.map((hint) => (
                <li key={hint}>• {hint}</li>
              ))}
              <li>
                • Remover o acesso (suspender/revogar) não exclui o aluno nem os dados históricos.
              </li>
            </ul>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {status.last_checkin_at ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Último check-in:{" "}
                  {format(new Date(status.last_checkin_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              ) : (
                <span>Nenhum check-in semanal registado</span>
              )}
              {status.last_import_at ? (
                <span>
                  Última importação:{" "}
                  {format(new Date(status.last_import_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {acessoOperacionalActions(acesso).map((action) => (
                <Button
                  key={action.value}
                  type="button"
                  size="sm"
                  variant={
                    action.value === "revoked" || action.value === "suspended"
                      ? "destructive"
                      : "default"
                  }
                  disabled={updatingAcesso}
                  onClick={() => void handleAcesso(action.value)}
                >
                  {updatingAcesso ? (
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                  ) : null}
                  {action.label}
                </Button>
              ))}
              {status.status === "match_available" &&
              status.email_match_candidate?.email_confirmed_at ? (
                <Button type="button" size="sm" variant="outline" onClick={handleQuickLink} disabled={linking}>
                  {linking ? (
                    <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Vincular cadastro
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate("/?tab=user-linking")}
              >
                Gerir vínculos
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
