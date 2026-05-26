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
import type { AlunoPortalStatus } from "@/types/aluno-portal-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StudentPortalStatusCardProps = {
  alunoId: string;
  refreshKey?: number;
  onLinked?: () => void;
};

const statusConfig: Record<
  AlunoPortalStatus["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }
> = {
  active: { label: "Portal activo", variant: "default", icon: CheckCircle2 },
  pending_email: { label: "Aguarda confirmação de email", variant: "secondary", icon: Mail },
  match_available: { label: "Cadastro encontrado — pode vincular", variant: "outline", icon: Link2 },
  no_access: { label: "Sem acesso ao portal", variant: "destructive", icon: UserX },
};

export default function StudentPortalStatusCard({
  alunoId,
  refreshKey = 0,
  onLinked,
}: StudentPortalStatusCardProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AlunoPortalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

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
    if (!candidate?.user_id || !status?.email_confirmed_at) return;

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

  const cfg = status ? statusConfig[status.status] : null;
  const StatusIcon = cfg?.icon ?? ShieldAlert;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Estado do portal</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Acesso do aluno a /portal-aluno (credencial e vínculo).
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
              {status.is_technical_import_email ? (
                <Badge variant="outline" className="text-[10px]">
                  Email técnico (import)
                </Badge>
              ) : null}
            </div>

            {status.credential_email && status.status !== "no_access" ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Credencial: </span>
                <span className="font-medium">{status.credential_email}</span>
              </p>
            ) : null}

            {status.email_match_candidate && status.status === "match_available" ? (
              <p className="text-sm text-muted-foreground">
                Cadastro: <span className="font-medium text-foreground">{status.email_match_candidate.email}</span>
                {status.email_match_candidate.email_confirmed_at
                  ? " · email confirmado"
                  : " · email ainda não confirmado"}
              </p>
            ) : null}

            <ul className="space-y-1 text-xs text-muted-foreground">
              {status.hints.map((hint) => (
                <li key={hint}>• {hint}</li>
              ))}
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
              {status.status === "match_available" &&
              status.email_match_candidate?.email_confirmed_at ? (
                <Button type="button" size="sm" onClick={handleQuickLink} disabled={linking}>
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
