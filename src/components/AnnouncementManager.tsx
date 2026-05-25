import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { toast } from "sonner";
import { Loader2, Megaphone, Plus, Users, User } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";

interface Turma {
  id: string;
  nome: string;
  cor: string;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  created_at: string;
  anexo_url: string | null;
}

export function AnnouncementManager() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tipoEnvio, setTipoEnvio] = useState<"individual" | "turma" | "massa">("individual");
  const [formData, setFormData] = useState({
    titulo: "",
    mensagem: "",
    anexo_url: "",
  });
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    loadAvisos();
    loadTurmas();
    loadAlunos();
  }, [user]);

  const loadAvisos = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/avisos');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const filtrados = data
        .filter((a: any) => a.coach_id === user.id)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 20);
      setAvisos(filtrados);
    } catch (error) {
      console.error("Erro ao carregar avisos:", error);
      toast.error("Erro ao carregar avisos");
    }
  };

  const loadTurmas = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/turmas');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const filtrados = data.filter((t: any) => t.coach_id === user.id && t.ativo === true);
      setTurmas(filtrados);
    } catch (error) {
      console.error("Erro ao carregar turmas:", error);
      toast.error("Erro ao carregar turmas");
    }
  };

  const loadAlunos = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/alunos');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const filtrados = data
        .filter((a: any) => a.coach_id === user.id)
        .sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
      setAlunos(filtrados);
    } catch (error) {
      console.error("Erro ao carregar alunos:", error);
      toast.error("Erro ao carregar alunos");
    }
  };

  const notifyAlunos = async (alunoIds: Iterable<string>) => {
    const notified = new Set<string>();
    for (const alunoId of alunoIds) {
      if (!alunoId || notified.has(alunoId)) continue;
      notified.add(alunoId);
      await apiClient.requestSafe("/api/notificacoes", {
        method: "POST",
        body: JSON.stringify({
          coach_id: user!.id,
          aluno_id: alunoId,
          tipo: "aviso",
          titulo: formData.titulo,
          mensagem: formData.mensagem,
          link: "messages",
        }),
      });
    }
    return notified.size;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submittingRef.current || loading) return;

    if (tipoEnvio === "individual" && selectedAlunos.length === 0) {
      toast.error("Selecione pelo menos um aluno");
      return;
    }

    if (tipoEnvio === "turma" && selectedTurmas.length === 0) {
      toast.error("Selecione pelo menos uma turma");
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const avisoResult = await apiClient.requestSafe<any>("/api/avisos", {
        method: "POST",
        body: JSON.stringify({
          coach_id: user.id,
          titulo: formData.titulo,
          mensagem: formData.mensagem,
          tipo: tipoEnvio,
          anexo_url: formData.anexo_url || null,
        }),
      });

      const aviso = avisoResult.success ? avisoResult.data : null;
      if (!aviso?.id) {
        toast.error("Erro ao criar aviso");
        return;
      }

      const destinatarios: Array<{
        aviso_id: string;
        aluno_id: string | null;
        turma_id: string | null;
      }> = [];
      const alunoIdsParaNotificar = new Set<string>();

      if (tipoEnvio === "individual") {
        for (const alunoId of selectedAlunos) {
          destinatarios.push({
            aviso_id: aviso.id,
            aluno_id: alunoId,
            turma_id: null,
          });
          alunoIdsParaNotificar.add(alunoId);
        }
      } else if (tipoEnvio === "turma") {
        const turmaIds = [...new Set(selectedTurmas)];
        for (const turmaId of turmaIds) {
          destinatarios.push({
            aviso_id: aviso.id,
            aluno_id: null,
            turma_id: turmaId,
          });
          const membrosResult = await apiClient.requestSafe<any[]>(
            `/api/turmas-alunos?turma_id=${turmaId}`,
          );
          const membros =
            membrosResult.success && Array.isArray(membrosResult.data)
              ? membrosResult.data
              : [];
          for (const membro of membros) {
            if (membro?.aluno_id) alunoIdsParaNotificar.add(membro.aluno_id);
          }
        }
      } else if (tipoEnvio === "massa") {
        for (const aluno of alunos) {
          destinatarios.push({
            aviso_id: aviso.id,
            aluno_id: aluno.id,
            turma_id: null,
          });
          alunoIdsParaNotificar.add(aluno.id);
        }
      }

      for (const destinatario of destinatarios) {
        await apiClient.requestSafe("/api/avisos-destinatarios", {
          method: "POST",
          body: JSON.stringify(destinatario),
        });
      }

      const totalAlunos = await notifyAlunos(alunoIdsParaNotificar);

      if (tipoEnvio === "turma") {
        const turmaCount = [...new Set(selectedTurmas)].length;
        toast.success(
          `Aviso enviado para ${totalAlunos} aluno(s) em ${turmaCount} turma(s)!`,
        );
      } else {
        toast.success(`Aviso enviado para ${totalAlunos} aluno(s)!`);
      }

      setIsDialogOpen(false);
      resetForm();
      loadAvisos();
    } catch (error) {
      console.error("Erro ao enviar aviso:", error);
      toast.error("Erro ao enviar aviso");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ titulo: "", mensagem: "", anexo_url: "" });
    setSelectedTurmas([]);
    setSelectedAlunos([]);
    setTipoEnvio("individual");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Avisos em Massa</h2>
          <p className="text-muted-foreground">
            Envie comunicados para seus alunos e turmas
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (loading) return;
            setIsDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Aviso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Aviso</DialogTitle>
              <DialogDescription>
                Escolha o público (alunos, turmas ou todos), redija título e mensagem e opcionalmente um anexo.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Tipo de Envio</Label>
                <RadioGroup
                  value={tipoEnvio}
                  onValueChange={(v: any) => setTipoEnvio(v)}
                  disabled={loading}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="font-normal cursor-pointer">
                      Alunos Específicos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="turma" id="turma" />
                    <Label htmlFor="turma" className="font-normal cursor-pointer">
                      Turmas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="massa" id="massa" />
                    <Label htmlFor="massa" className="font-normal cursor-pointer">
                      Todos os Alunos
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {tipoEnvio === "individual" && (
                <div>
                  <Label>Selecionar Alunos</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {alunos.map((aluno) => (
                      <div key={aluno.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`aluno-${aluno.id}`}
                          checked={selectedAlunos.includes(aluno.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAlunos([...selectedAlunos, aluno.id]);
                            } else {
                              setSelectedAlunos(selectedAlunos.filter(id => id !== aluno.id));
                            }
                          }}
                        />
                        <label htmlFor={`aluno-${aluno.id}`} className="cursor-pointer">
                          {aluno.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tipoEnvio === "turma" && (
                <div>
                  <Label>Selecionar Turmas</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {turmas.map((turma) => (
                      <div key={turma.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`turma-${turma.id}`}
                          checked={selectedTurmas.includes(turma.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTurmas([...selectedTurmas, turma.id]);
                            } else {
                              setSelectedTurmas(selectedTurmas.filter(id => id !== turma.id));
                            }
                          }}
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: turma.cor }}
                        />
                        <label htmlFor={`turma-${turma.id}`} className="cursor-pointer">
                          {turma.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Título do aviso"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  placeholder="Escreva sua mensagem..."
                  rows={6}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="anexo_url">Link/Anexo (opcional)</Label>
                <Input
                  id="anexo_url"
                  value={formData.anexo_url}
                  onChange={(e) => setFormData({ ...formData, anexo_url: e.target.value })}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>

              {loading && (
                <p className="text-xs text-muted-foreground text-center">
                  A enviar… não feche esta janela até concluir.
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar Aviso"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Avisos</CardTitle>
          <CardDescription>
            Últimos {avisos.length} avisos enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {avisos.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum aviso enviado ainda. Crie seu primeiro aviso!
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {avisos.map((aviso) => (
                <div key={aviso.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{aviso.titulo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(aviso.created_at)}
                      </p>
                    </div>
                    <Badge variant={
                      aviso.tipo === "massa" ? "default" :
                      aviso.tipo === "turma" ? "secondary" :
                      "outline"
                    }>
                      {aviso.tipo === "massa" && <Users className="mr-1 h-3 w-3" />}
                      {aviso.tipo === "turma" && <Users className="mr-1 h-3 w-3" />}
                      {aviso.tipo === "individual" && <User className="mr-1 h-3 w-3" />}
                      {aviso.tipo === "massa" ? "Todos" :
                       aviso.tipo === "turma" ? "Turmas" : "Individual"}
                    </Badge>
                  </div>
                  <p className="text-sm">{aviso.mensagem}</p>
                  {aviso.anexo_url && (
                    <a
                      href={aviso.anexo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      Ver anexo
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}