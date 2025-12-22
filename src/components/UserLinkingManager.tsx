import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Search, 
  Link2, 
  Unlink, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  AlertCircle, 
  Check,
  Mail,
  FileText,
  Users,
  ArrowRight
} from "lucide-react";

interface Aluno {
  id: string;
  nome: string | null;
  email: string;
  cpf_cnpj: string | null;
  coach_id: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

export default function UserLinkingManager() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [usuarios, setUsuarios] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [selectedCredential, setSelectedCredential] = useState<string>("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar alunos do coach
      const { data: alunosData, error: alunosError } = await supabase
        .from("alunos")
        .select("*")
        .eq("coach_id", user.id)
        .order("nome");

      if (alunosError) throw alunosError;

      // Buscar usuários com role 'aluno'
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "aluno");

      if (rolesError) throw rolesError;

      setAlunos(alunosData || []);
      setUsuarios(rolesData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Verifica se um aluno está vinculado a uma credencial
  const isLinked = (aluno: Aluno) => {
    return usuarios.some(u => {
      // Verifica se o email do aluno corresponde a alguma credencial
      return aluno.email && aluno.email.toLowerCase() !== '' && 
             usuarios.some(usuario => usuario.user_id);
    });
  };

  // Credenciais disponíveis (não vinculadas a nenhum aluno)
  const credenciaisDisponiveis = usuarios.filter(u => {
    return !alunos.some(a => a.email?.toLowerCase() === u.email?.toLowerCase());
  });

  // Alunos filtrados por busca
  const alunosFiltrados = alunos.filter(a => {
    const termo = searchTerm.toLowerCase();
    return (
      a.nome?.toLowerCase().includes(termo) ||
      a.email?.toLowerCase().includes(termo) ||
      a.cpf_cnpj?.includes(termo)
    );
  });

  // Estatísticas
  const totalAlunos = alunos.length;
  const alunosVinculados = alunos.filter(a => a.email && a.email.includes('@')).length;
  const alunosPendentes = totalAlunos - alunosVinculados;

  const handleOpenLinkDialog = (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setSelectedCredential("");
    setIsLinkDialogOpen(true);
  };

  const handleLink = async () => {
    if (!selectedAluno || !selectedCredential) return;
    
    setLinking(true);
    try {
      // Buscar o email da credencial selecionada
      const credencial = usuarios.find(u => u.user_id === selectedCredential);
      if (!credencial?.email) {
        toast.error("Credencial não encontrada");
        return;
      }

      // Atualizar o email do aluno para corresponder à credencial
      const { error } = await supabase
        .from("alunos")
        .update({ email: credencial.email })
        .eq("id", selectedAluno.id);

      if (error) throw error;

      toast.success("Usuário vinculado com sucesso!");
      setIsLinkDialogOpen(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao vincular:", error);
      toast.error("Erro ao vincular usuário");
    } finally {
      setLinking(false);
    }
  };

  const getStatusBadge = (aluno: Aluno) => {
    if (aluno.email && aluno.email.includes('@')) {
      return (
        <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
          <UserCheck className="w-3 h-3 mr-1" />
          Vinculado
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        <UserX className="w-3 h-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="w-6 h-6 text-primary" />
          Vincular Usuários Importados
        </h2>
        <p className="text-muted-foreground mt-1">
          Associe usuários importados via upload de ficha às credenciais criadas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Importados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAlunos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Vinculados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{alunosVinculados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-amber-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{alunosPendentes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {alunos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum usuário importado</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Faça upload de fichas de alunos para importá-los e depois vincule às credenciais criadas.
            </p>
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              Importar Fichas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search and Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Usuários Importados</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alunosFiltrados.map((aluno) => (
                      <TableRow key={aluno.id}>
                        <TableCell className="font-medium">
                          {aluno.nome || "Sem nome"}
                        </TableCell>
                        <TableCell>
                          {aluno.cpf_cnpj || "-"}
                        </TableCell>
                        <TableCell>
                          {aluno.email || "-"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(aluno)}
                        </TableCell>
                        <TableCell className="text-right">
                          {aluno.email && aluno.email.includes('@') ? (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              disabled
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Vinculado
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleOpenLinkDialog(aluno)}
                            >
                              <Link2 className="w-4 h-4 mr-1" />
                              Vincular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Success Message when all linked */}
          {alunosPendentes === 0 && totalAlunos > 0 && (
            <Alert className="border-primary/30 bg-primary/5">
              <Check className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <strong>Configuração concluída!</strong> Todos os usuários importados foram vinculados às suas credenciais.
                O sistema está pronto para uso.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Vincular Usuário
            </DialogTitle>
            <DialogDescription>
              Selecione a credencial para vincular a este usuário importado
            </DialogDescription>
          </DialogHeader>

          {selectedAluno && (
            <div className="py-4 space-y-4">
              {/* Aluno Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Usuário:</span>
                  <span className="font-medium">{selectedAluno.nome || "Sem nome"}</span>
                </div>
                {selectedAluno.cpf_cnpj && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Documento:</span>
                    <span>{selectedAluno.cpf_cnpj}</span>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowRight className="w-6 h-6 text-primary" />
              </div>

              {/* Credential Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Selecionar credencial para vínculo
                </label>
                <Select value={selectedCredential} onValueChange={setSelectedCredential}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Escolha uma credencial..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {credenciaisDisponiveis.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhuma credencial disponível
                      </div>
                    ) : (
                      credenciaisDisponiveis.map((cred) => (
                        <SelectItem key={cred.user_id} value={cred.user_id}>
                          {cred.email || `Usuário ${cred.user_id.slice(0, 8)}...`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {credenciaisDisponiveis.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Não há credenciais disponíveis. Peça ao usuário para criar uma conta primeiro.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleLink} 
              disabled={!selectedCredential || linking}
            >
              {linking ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Vincular Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
