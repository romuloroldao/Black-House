import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import { Users, Plus, Trash2, Edit, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface Turma {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface TurmaAluno {
  aluno_id: string;
  alunos: Aluno;
}

export function ClassGroupManager() {
  const { user } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [membros, setMembros] = useState<TurmaAluno[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    cor: "#3b82f6",
  });
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTurmas();
    loadAlunos();
  }, [user]);

  const loadTurmas = async () => {
    if (!user) return;

    try {
      const result = await apiClient.requestSafe<any[]>('/api/turmas');
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      const filtrados = data
        .filter((t: any) => t.coach_id === user.id && t.ativo === true)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
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

  const loadMembros = async (turmaId: string) => {
    try {
      // Buscar membros da turma
      const membrosRes = await apiClient.requestSafe<any[]>(`/api/turmas-alunos?turma_id=${turmaId}`);
      const membrosTurma = membrosRes.success && Array.isArray(membrosRes.data) ? membrosRes.data : [];
      
      // Buscar dados dos alunos para cada membro
      const alunosRes = await apiClient.requestSafe<any[]>('/api/alunos');
      const alunosData = alunosRes.success && Array.isArray(alunosRes.data) ? alunosRes.data : [];
      const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));
      const membrosCompletos = membrosTurma.map((membro: any) => {
        const aluno = alunosMap.get(membro.aluno_id);
        return {
          aluno_id: membro.aluno_id,
          alunos: aluno || { id: membro.aluno_id, nome: "Desconhecido", email: "" }
        };
      });

      setMembros(membrosCompletos);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
      toast.error("Erro ao carregar membros");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      if (selectedTurma) {
        const result = await apiClient.requestSafe(`/api/turmas/${selectedTurma.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...formData }),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao atualizar turma');
        }

        toast.success("Turma atualizada com sucesso!");
      } else {
        const result = await apiClient.requestSafe('/api/turmas', {
          method: 'POST',
          body: JSON.stringify({ ...formData, coach_id: user.id }),
        });
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar turma');
        }

        toast.success("Turma criada com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar turma:", error);
      toast.error(selectedTurma ? "Erro ao atualizar turma" : "Erro ao criar turma");
      setLoading(false);
      return;
    }

    setLoading(false);
    setIsDialogOpen(false);
    resetForm();
    loadTurmas();
  };

  const handleAddMembers = async () => {
    if (!selectedTurma || selectedAlunos.length === 0) return;

    setLoading(true);

    try {
      // Inserir membros um por um (apiClient não suporta batch insert)
      for (const alunoId of selectedAlunos) {
        await apiClient.requestSafe('/api/turmas-alunos', {
          method: 'POST',
          body: JSON.stringify({
            turma_id: selectedTurma.id,
            aluno_id: alunoId,
          }),
        });
      }
    } catch (error) {
      console.error("Erro ao adicionar alunos:", error);
      toast.error("Erro ao adicionar alunos");
      setLoading(false);
      return;
    }

    toast.success(`${selectedAlunos.length} aluno(s) adicionado(s) à turma!`);
    setLoading(false);
    setIsAddMembersOpen(false);
    setSelectedAlunos([]);
    loadMembros(selectedTurma.id);
  };

  const handleRemoveMember = async (alunoId: string) => {
    if (!selectedTurma) return;

    try {
      const membrosRes = await apiClient.requestSafe<any[]>(`/api/turmas-alunos?turma_id=${selectedTurma.id}&aluno_id=${alunoId}`);
      const membros = membrosRes.success && Array.isArray(membrosRes.data) ? membrosRes.data : [];
      for (const membro of membros) {
        await apiClient.requestSafe(`/api/turmas-alunos/${membro.id}`, { method: 'DELETE' });
      }

      toast.success("Aluno removido da turma!");
      loadMembros(selectedTurma.id);
    } catch (error) {
      console.error("Erro ao remover aluno:", error);
      toast.error("Erro ao remover aluno");
    }
  };

  const handleDeleteTurma = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta turma?")) return;

    try {
      const result = await apiClient.requestSafe(`/api/turmas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: false }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir turma');
      }

      toast.success("Turma excluída com sucesso!");
      loadTurmas();
      if (selectedTurma?.id === id) {
        setSelectedTurma(null);
      }
    } catch (error) {
      console.error("Erro ao excluir turma:", error);
      toast.error("Erro ao excluir turma");
    }
  };

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", cor: "#3b82f6" });
    setSelectedTurma(null);
  };

  const openEditDialog = (turma: Turma) => {
    setSelectedTurma(turma);
    setFormData({
      nome: turma.nome,
      descricao: turma.descricao || "",
      cor: turma.cor,
    });
    setIsDialogOpen(true);
  };

  const selectTurma = (turma: Turma) => {
    setSelectedTurma(turma);
    loadMembros(turma.id);
  };

  const alunosDisponiveis = alunos.filter(
    aluno => !membros.some(m => m.aluno_id === aluno.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gestão de Turmas</h2>
          <p className="text-muted-foreground">Organize seus alunos em turmas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedTurma ? "Editar Turma" : "Nova Turma"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Turma</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Turma de Segunda e Quarta - Avançado"
                  required
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva a turma..."
                />
              </div>
              <div>
                <Label htmlFor="cor">Cor</Label>
                <Input
                  id="cor"
                  type="color"
                  value={formData.cor}
                  onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Salvando..." : selectedTurma ? "Atualizar" : "Criar Turma"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Turmas</CardTitle>
            <CardDescription>
              {turmas.length} turma(s) cadastrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {turmas.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhuma turma cadastrada. Crie sua primeira turma!
                  </AlertDescription>
                </Alert>
              ) : (
                turmas.map((turma) => (
                  <div
                    key={turma.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedTurma?.id === turma.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => selectTurma(turma)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: turma.cor }}
                        />
                        <div>
                          <h3 className="font-semibold">{turma.nome}</h3>
                          {turma.descricao && (
                            <p className="text-sm text-muted-foreground">
                              {turma.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(turma);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTurma(turma.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Membros</CardTitle>
                <CardDescription>
                  {selectedTurma
                    ? `${membros.length} aluno(s) na turma`
                    : "Selecione uma turma"}
                </CardDescription>
              </div>
              {selectedTurma && (
                <Dialog open={isAddMembersOpen} onOpenChange={setIsAddMembersOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Alunos à Turma</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {alunosDisponiveis.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            Todos os alunos já estão nesta turma.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {alunosDisponiveis.map((aluno) => (
                            <div
                              key={aluno.id}
                              className="flex items-center space-x-2 p-2 hover:bg-accent rounded"
                            >
                              <Checkbox
                                id={aluno.id}
                                checked={selectedAlunos.includes(aluno.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedAlunos([...selectedAlunos, aluno.id]);
                                  } else {
                                    setSelectedAlunos(
                                      selectedAlunos.filter((id) => id !== aluno.id)
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={aluno.id}
                                className="flex-1 cursor-pointer"
                              >
                                <p className="font-medium">{aluno.nome}</p>
                                <p className="text-sm text-muted-foreground">
                                  {aluno.email}
                                </p>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={handleAddMembers}
                        disabled={selectedAlunos.length === 0 || loading}
                        className="w-full"
                      >
                        {loading ? "Adicionando..." : `Adicionar ${selectedAlunos.length} aluno(s)`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTurma ? (
              <Alert>
                <AlertDescription>
                  Selecione uma turma para ver seus membros
                </AlertDescription>
              </Alert>
            ) : membros.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Esta turma ainda não tem membros. Adicione alunos!
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {membros.map((membro) => (
                  <div
                    key={membro.aluno_id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{membro.alunos.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {membro.alunos.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(membro.aluno_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}