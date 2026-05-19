import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, User, Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  anexo_url: string | null;
  created_at: string;
  coach_id: string;
  coach_display_name: string;
  lido: boolean;
  lido_em: string | null;
  destinatario_id: string;
}

function displayNameFromCoachUser(data: Record<string, unknown> | null | undefined): string {
  if (!data) return "Coach";
  const nome = typeof data.coach_nome_completo === "string" ? data.coach_nome_completo.trim() : "";
  if (nome) return nome;
  const email = typeof data.email === "string" ? data.email : "";
  if (email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "Coach";
}

async function coachDisplayNamesById(coachIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(coachIds.filter((id) => typeof id === "string" && id.length > 0))];
  await Promise.all(
    unique.map(async (id) => {
      const res = await apiClient.requestSafe<Record<string, unknown>>(
        `/auth/user-by-id?user_id=${encodeURIComponent(id)}`
      );
      map.set(id, res.success && res.data ? displayNameFromCoachUser(res.data) : "Coach");
    })
  );
  return map;
}

export default function StudentMessagesView() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (user) {
      loadAvisos();
    }
  }, [user]);

  const loadAvisos = async () => {
    if (!user) return;

    setLoading(true);

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      setLoading(false);
      return;
    }

    const destinatariosResult = await apiClient.requestSafe<any[]>("/api/avisos-destinatarios");
    const avisosResult = await apiClient.requestSafe<any[]>("/api/avisos");
    const turmasResult = await apiClient.requestSafe<any[]>("/api/turmas-alunos");

    const destinatarios = destinatariosResult.success && Array.isArray(destinatariosResult.data)
      ? destinatariosResult.data
      : [];
    const avisosRaw = avisosResult.success && Array.isArray(avisosResult.data) ? avisosResult.data : [];
    const turmasAluno = turmasResult.success && Array.isArray(turmasResult.data) ? turmasResult.data : [];

    const avisosMap = new Map(avisosRaw.map((aviso: any) => [aviso.id, aviso]));

    const avisosIndividuais = destinatarios
      .filter((dest: any) => dest.aluno_id === aluno.id)
      .map((dest: any) => ({ ...dest, avisos: avisosMap.get(dest.aviso_id) || null }));

    const turmaIds = turmasAluno.filter((t: any) => t.aluno_id === aluno.id).map((t: any) => t.turma_id);
    const avisosTurma =
      turmaIds.length > 0
        ? destinatarios
            .filter((dest: any) => dest.turma_id && turmaIds.includes(dest.turma_id))
            .map((dest: any) => ({ ...dest, avisos: avisosMap.get(dest.aviso_id) || null }))
        : [];

    const todosAvisos = [...avisosIndividuais, ...avisosTurma];

    const baseRows = todosAvisos
      .filter((item) => item.avisos)
      .map((item) => ({
        id: item.avisos.id,
        titulo: item.avisos.titulo,
        mensagem: item.avisos.mensagem,
        tipo: item.avisos.tipo,
        anexo_url: item.avisos.anexo_url,
        created_at: item.avisos.created_at,
        coach_id: item.avisos.coach_id as string,
        lido: item.lido,
        lido_em: item.lido_em,
        destinatario_id: item.id,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const nameByCoach = await coachDisplayNamesById(baseRows.map((r) => r.coach_id));

    const withNames: Aviso[] = baseRows.map((r) => ({
      ...r,
      coach_display_name: nameByCoach.get(r.coach_id) || "Coach",
    }));

    setAvisos(withNames);
    setLoading(false);
  };

  const handleAvisoClick = async (aviso: Aviso) => {
    setSelectedAviso(aviso);

    if (!aviso.lido) {
      const patch = await apiClient.requestSafe(`/api/avisos-destinatarios/${aviso.destinatario_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lido: true,
          lido_em: new Date().toISOString(),
        }),
      });
      if (!patch.success) {
        toast.error(patch.error || "Não foi possível marcar como lida");
        return;
      }

      setAvisos((prev) =>
        prev.map((a) =>
          a.destinatario_id === aviso.destinatario_id
            ? { ...a, lido: true, lido_em: new Date().toISOString() }
            : a
        )
      );
      setSelectedAviso((prev) =>
        prev && prev.destinatario_id === aviso.destinatario_id
          ? { ...prev, lido: true, lido_em: new Date().toISOString() }
          : prev
      );
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case "massa":
        return <Users className="h-4 w-4" />;
      case "turma":
        return <Users className="h-4 w-4" />;
      case "individual":
        return <User className="h-4 w-4" />;
      default:
        return <Megaphone className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (tipo: string) => {
    switch (tipo) {
      case "massa":
        return "Para todos";
      case "turma":
        return "Para turma";
      case "individual":
        return "Individual";
      default:
        return tipo;
    }
  };

  const coachNamesSubtitle =
    avisos.length > 0
      ? [...new Set(avisos.map((a) => a.coach_display_name).filter((n) => n && n !== "Coach"))].join(", ")
      : "";

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mensagens dos coaches</h1>
          <p className="text-muted-foreground">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  const avisosNaoLidos = avisos.filter((a) => !a.lido).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens dos coaches</h1>
        <p className="text-muted-foreground">
          Avisos enviados pelos coaches da equipa. Cada mensagem mostra quem enviou.
        </p>
        {coachNamesSubtitle ? (
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">Coaches nesta lista:</span> {coachNamesSubtitle}
          </p>
        ) : null}
        {avisosNaoLidos > 0 && (
          <Badge variant="default" className="mt-2">
            {avisosNaoLidos} não {avisosNaoLidos === 1 ? "lida" : "lidas"}
          </Badge>
        )}
      </div>

      {avisos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertDescription>Nenhuma mensagem recebida ainda.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {avisos.map((aviso) => (
            <Card
              key={aviso.destinatario_id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                !aviso.lido ? "border-primary" : ""
              }`}
              onClick={() => handleAvisoClick(aviso)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{aviso.titulo}</CardTitle>
                      {!aviso.lido && (
                        <Badge variant="default" className="text-xs">
                          Nova
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                      {getTypeIcon(aviso.tipo)}
                      <span>{getTypeLabel(aviso.tipo)}</span>
                      <span>•</span>
                      <span>{formatDate(aviso.created_at)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-foreground/90 font-medium">
                        Enviado por {aviso.coach_display_name}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-2">{aviso.mensagem}</p>
                {aviso.anexo_url && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                    <ExternalLink className="h-4 w-4" />
                    <span>Contém anexo</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedAviso} onOpenChange={() => setSelectedAviso(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAviso?.titulo}</DialogTitle>
            <DialogDescription className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span className="flex items-center gap-2">
                {selectedAviso && getTypeIcon(selectedAviso.tipo)}
                <span>{selectedAviso && getTypeLabel(selectedAviso.tipo)}</span>
                <span>•</span>
                <span>{selectedAviso && formatDate(selectedAviso.created_at)}</span>
              </span>
              {selectedAviso ? (
                <span className="text-foreground font-medium">
                  Enviado por {selectedAviso.coach_display_name}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="whitespace-pre-wrap">{selectedAviso?.mensagem}</p>
            </div>
            {selectedAviso?.anexo_url && (
              <div>
                <a
                  href={selectedAviso.anexo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir anexo
                </a>
              </div>
            )}
            {selectedAviso?.lido_em && (
              <p className="text-sm text-muted-foreground">Lida em: {formatDate(selectedAviso.lido_em)}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
