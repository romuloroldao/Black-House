import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  lido: boolean;
  lido_em: string | null;
  destinatario_id: string;
}

export default function StudentMessagesView() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [coachName, setCoachName] = useState<string>("Coach");

  useEffect(() => {
    if (user) {
      loadAvisos();
      loadCoachName();
    }
  }, [user]);

  const loadCoachName = async () => {
    if (!user) return;

    // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
    const aluno = await apiClient.getMe();

    if (aluno?.coach_id) {
      // Buscar dados do coach (usuário)
      try {
        const users = await apiClient
          .from("users")
          .select("email")
          .eq("id", aluno.coach_id);
        const userData = Array.isArray(users) && users.length > 0 ? users[0] : null;
        if (userData?.email) {
          setCoachName(userData.email.split("@")[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar nome do coach:", error);
      }
    }
  };

  const loadAvisos = async () => {
    if (!user) return;

    setLoading(true);

    // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
    const aluno = await apiClient.getMe();

    if (!aluno) {
      setLoading(false);
      return;
    }

    // Buscar avisos individuais
    const avisosDestinatariosIndividuais = await apiClient
      .from("avisos_destinatarios")
      .select("*")
      .eq("aluno_id", aluno.id)
      .order("created_at", { ascending: false });

    // Buscar avisos para cada destinatário
    const avisosIndividuais = await Promise.all(
      (Array.isArray(avisosDestinatariosIndividuais) ? avisosDestinatariosIndividuais : []).map(async (dest) => {
        if (dest.aviso_id) {
          const avisos = await apiClient
            .from("avisos")
            .select("*")
            .eq("id", dest.aviso_id);
          const aviso = Array.isArray(avisos) && avisos.length > 0 ? avisos[0] : null;
          return { ...dest, avisos: aviso };
        }
        return { ...dest, avisos: null };
      })
    );

    // Buscar turmas do aluno
    const turmasAluno = await apiClient
      .from("turmas_alunos")
      .select("turma_id")
      .eq("aluno_id", aluno.id);

    const turmaIds = Array.isArray(turmasAluno) ? turmasAluno.map(t => t.turma_id) : [];

    // Buscar avisos das turmas
    let avisosTurma: any[] = [];
    if (turmaIds.length > 0) {
      // Buscar todos os avisos destinatários e filtrar por turma_id
      const avisosDestinatariosTurma = await apiClient
        .from("avisos_destinatarios")
        .select("*")
        .order("created_at", { ascending: false });
      
      const avisosFiltrados = Array.isArray(avisosDestinatariosTurma)
        ? avisosDestinatariosTurma.filter(ad => turmaIds.includes(ad.turma_id))
        : [];

      // Buscar avisos para cada destinatário
      avisosTurma = await Promise.all(
        avisosFiltrados.map(async (dest) => {
          if (dest.aviso_id) {
            const avisos = await apiClient
              .from("avisos")
              .select("*")
              .eq("id", dest.aviso_id);
            const aviso = Array.isArray(avisos) && avisos.length > 0 ? avisos[0] : null;
            return { ...dest, avisos: aviso };
          }
          return { ...dest, avisos: null };
        })
      );
    }

    // Combinar e processar avisos
    const todosAvisos = [...avisosIndividuais, ...avisosTurma];
    
    const avisosProcessados = todosAvisos
      .filter(item => item.avisos)
      .map(item => ({
        id: item.avisos.id,
        titulo: item.avisos.titulo,
        mensagem: item.avisos.mensagem,
        tipo: item.avisos.tipo,
        anexo_url: item.avisos.anexo_url,
        created_at: item.avisos.created_at,
        coach_id: item.avisos.coach_id,
        lido: item.lido,
        lido_em: item.lido_em,
        destinatario_id: item.id,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setAvisos(avisosProcessados);
    setLoading(false);
  };

  const handleAvisoClick = async (aviso: Aviso) => {
    setSelectedAviso(aviso);

    if (!aviso.lido) {
      await apiClient
        .from("avisos_destinatarios")
        .update({ 
          lido: true, 
          lido_em: new Date().toISOString(),
          id: aviso.destinatario_id
        });

      setAvisos(avisos.map(a => 
        a.destinatario_id === aviso.destinatario_id 
          ? { ...a, lido: true, lido_em: new Date().toISOString() }
          : a
      ));
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mensagens do Coach</h1>
          <p className="text-muted-foreground">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  const avisosNaoLidos = avisos.filter(a => !a.lido).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mensagens do Coach</h1>
        <p className="text-muted-foreground">
          Todas as mensagens e avisos enviados pelo seu coach
        </p>
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
              <AlertDescription>
                Nenhuma mensagem recebida ainda.
              </AlertDescription>
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
                    <CardDescription className="flex items-center gap-2 mt-1">
                      {getTypeIcon(aviso.tipo)}
                      <span>{getTypeLabel(aviso.tipo)}</span>
                      <span>•</span>
                      <span>{formatDate(aviso.created_at)}</span>
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
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {selectedAviso && getTypeIcon(selectedAviso.tipo)}
              <span>{selectedAviso && getTypeLabel(selectedAviso.tipo)}</span>
              <span>•</span>
              <span>{selectedAviso && formatDate(selectedAviso.created_at)}</span>
            </p>
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
              <p className="text-sm text-muted-foreground">
                Lida em: {formatDate(selectedAviso.lido_em)}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
