import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
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
  ArrowRight,
  UserPlus,
  Copy,
  Clock,
  Trash2
} from "lucide-react";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";

interface Aluno {
  id: string;
  nome: string | null;
  email: string;
  cpf_cnpj: string | null;
  coach_id: string | null;
  coach_email?: string | null;
  coach_nome?: string | null;
  user_id?: string | null; // FONTE DE VERDADE: vínculo com credencial de usuário (opcional para compatibilidade)
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

interface UnlinkedRegistration {
  user_id: string;
  email: string;
  created_at?: string;
  email_confirmed_at?: string | null;
}

export default function UserLinkingManager() {
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [usuarios, setUsuarios] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [selectedCredential, setSelectedCredential] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [cadastrosPendentes, setCadastrosPendentes] = useState<UnlinkedRegistration[]>([]);
  const [adoptingUserId, setAdoptingUserId] = useState<string | null>(null);
  const [dismissingUserId, setDismissingUserId] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<Array<{ user_id: string; email?: string }>>([]);
  const [adoptCoachId, setAdoptCoachId] = useState<string>("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user) {
      carregarDados();
    }
  }, [user]);

  const carregarDados = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Buscar alunos do coach
      const alunosEndpoint = isAdmin ? '/api/alunos/by-coach' : '/api/alunos';
      const alunosResult = await apiClient.requestSafe<any[]>(alunosEndpoint);
      const rolesResult = await apiClient.requestSafe<any[]>('/api/user-roles');
      const unlinkedResult = await apiClient.requestSafe<UnlinkedRegistration[]>(
        '/api/alunos/unlinked-registrations'
      );

      const alunosData = alunosResult.success && Array.isArray(alunosResult.data) ? alunosResult.data : [];
      const rolesData = rolesResult.success && Array.isArray(rolesResult.data) ? rolesResult.data : [];

      const alunosFiltrados = (isAdmin
        ? alunosData
        : alunosData.filter((a: any) => a.coach_id === user.id)
      ).sort((a: any, b: any) => String(a?.nome || '').localeCompare(String(b?.nome || '')));

      if (isAdmin) {
        const coachRoles = rolesData.filter((r: any) => r.role === "coach");
        const coachesComEmail: Array<{ user_id: string; email?: string }> = [];
        for (const c of coachRoles) {
          try {
            const coachUser = await apiClient.getUserById(c.user_id);
            coachesComEmail.push({ user_id: c.user_id, email: coachUser?.email });
          } catch {
            coachesComEmail.push({ user_id: c.user_id });
          }
        }
        setCoaches(coachesComEmail);
        if (!adoptCoachId && coachesComEmail[0]?.user_id) {
          setAdoptCoachId(coachesComEmail[0].user_id);
        }
      }

      const rolesFiltradas = rolesData.filter((r: any) => r.role === "aluno");

      // Buscar emails dos usuários do app_auth.users
      const usuariosComEmail: UserRole[] = [];
      if (Array.isArray(rolesFiltradas)) {
        for (const role of rolesFiltradas) {
          try {
            // Buscar email do usuário através do user_id
            const userData = await apiClient.getUserById(role.user_id);
            usuariosComEmail.push({
              ...role,
              email: userData?.email || undefined
            });
          } catch (err) {
            // Se não conseguir buscar email, adicionar sem email
            console.warn(`Não foi possível buscar email para user_id ${role.user_id}:`, err);
            usuariosComEmail.push(role);
          }
        }
      }

      const unlinkedData =
        unlinkedResult.success && Array.isArray(unlinkedResult.data)
          ? unlinkedResult.data
          : [];

      setAlunos(alunosFiltrados);
      setUsuarios(usuariosComEmail);
      setCadastrosPendentes(unlinkedData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Verifica se um aluno está vinculado a uma credencial
  // DESIGN-LINK-ALUNO-USER-001: FONTE DE VERDADE é user_id (não linked_user_id)
  // FALLBACK: Se user_id não existe (migração pendente), usar correspondência de email
  const isImportPlaceholderEmail = (email?: string | null) => {
    if (!email) return true;
    const v = email.trim().toLowerCase();
    return v.endsWith('@blackhouse.local') || v.startsWith('import-');
  };

  const deriveNameHintFromEmail = (addr?: string) => {
    if (!addr || addr.includes("@blackhouse.local")) return null;
    const local = addr.split("@")[0]?.replace(/[._-]+/g, " ").trim();
    if (!local || local.length < 2) return null;
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getDisplayName = (aluno: Aluno) => {
    if (aluno.nome && String(aluno.nome).trim()) return String(aluno.nome).trim();
    const cred = aluno.user_id ? usuarios.find((u) => u.user_id === aluno.user_id) : null;
    return deriveNameHintFromEmail(cred?.email || aluno.email) || "Sem nome";
  };

  const getDisplayEmail = (aluno: Aluno) => {
    if (aluno.user_id && isImportPlaceholderEmail(aluno.email)) {
      const cred = usuarios.find((u) => u.user_id === aluno.user_id);
      if (cred?.email) return cred.email;
    }
    return aluno.email || '-';
  };

  const getCoachLabel = (aluno: Aluno) => {
    if (aluno.coach_nome) return aluno.coach_nome;
    if (aluno.coach_email) return aluno.coach_email;
    return '—';
  };

  const isLinked = (aluno: Aluno) => {
    // Prioridade 1: user_id existe e não é null (campo canônico)
    if (aluno.user_id !== null && aluno.user_id !== undefined) {
      return true;
    }
    
    // FALLBACK: Se user_id não existe ainda, verificar correspondência real de email
    // Isso permite funcionamento durante a migração gradual
    if (aluno.email && aluno.email.includes('@')) {
      return usuarios.some(u => 
        u.email && 
        u.email.toLowerCase() === aluno.email.toLowerCase()
      );
    }
    
    return false;
  };

  // Credenciais disponíveis (não vinculadas a nenhum aluno)
  // DESIGN-LINK-ALUNO-USER-001: FONTE DE VERDADE é user_id (não linked_user_id)
  // FALLBACK: Durante migração, também verificar correspondência de email
  const credenciaisDisponiveis = usuarios.filter(u => {
    // Verificar se já existe um aluno vinculado a este user_id via user_id
    const vinculadoPorUserId = alunos.some(a => 
      a.user_id !== null && 
      a.user_id !== undefined &&
      a.user_id === u.user_id
    );
    
    if (vinculadoPorUserId) {
      return false; // Já vinculado via user_id
    }
    
    // FALLBACK: Se user_id não existe ainda, verificar email
    // Isso permite funcionamento durante migração gradual
    if (u.email) {
      const vinculadoPorEmail = alunos.some(a => 
        a.email && 
        a.email.toLowerCase() === u.email.toLowerCase() &&
        (!a.user_id || a.user_id === null || a.user_id === undefined)
      );
      
      if (vinculadoPorEmail) {
        return false; // Já vinculado por email (migração pendente)
      }
    }
    
    return true; // Credencial disponível para vínculo
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
  // Usar isLinked() como fonte de verdade, não heurística de '@'
  const totalAlunos = alunos.length;
  const alunosVinculados = alunos.filter(a => isLinked(a)).length;
  const alunosPendentes = totalAlunos - alunosVinculados;

  const handleOpenLinkDialog = (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setSelectedCredential("");
    setIsLinkDialogOpen(true);
  };

  const signupInviteUrl =
    !isAdmin && typeof window !== "undefined" && user?.id
      ? `${window.location.origin}/auth?coach=${encodeURIComponent(user.id)}`
      : "";

  const handleCopyInviteLink = async () => {
    if (!signupInviteUrl) return;
    try {
      await navigator.clipboard.writeText(signupInviteUrl);
      toast.success("Link de cadastro copiado!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleDismissRegistration = async (reg: UnlinkedRegistration) => {
    if (
      !(await confirmDelete(
        confirm,
        `Remover o cadastro de ${reg.email} da plataforma? A pessoa precisará criar conta novamente para acessar.`,
      ))
    ) {
      return;
    }
    setDismissingUserId(reg.user_id);
    try {
      await apiClient.request("/api/alunos/dismiss-registration", {
        method: "POST",
        body: JSON.stringify({ userIdToDismiss: reg.user_id }),
      });
      toast.success(`Cadastro de ${reg.email} removido.`);
      carregarDados();
    } catch (error: any) {
      toast.error("Erro ao remover cadastro: " + (error.message || "Erro desconhecido"));
    } finally {
      setDismissingUserId(null);
    }
  };

  const handleAdoptRegistration = async (reg: UnlinkedRegistration) => {
    if (isAdmin && !adoptCoachId) {
      toast.error("Selecione o coach responsável antes de criar a ficha.");
      return;
    }
    setAdoptingUserId(reg.user_id);
    try {
      await apiClient.request("/api/alunos/adopt-registration", {
        method: "POST",
        body: JSON.stringify({
          userIdToLink: reg.user_id,
          ...(isAdmin ? { assignCoachId: adoptCoachId } : {}),
        }),
      });
      toast.success(`Ficha criada para ${reg.email}`);
      carregarDados();
    } catch (error: any) {
      toast.error("Erro ao criar ficha: " + (error.message || "Erro desconhecido"));
    } finally {
      setAdoptingUserId(null);
    }
  };

  const handleLink = async () => {
    if (!selectedAluno || !selectedCredential) return;
    
    setLinking(true);
    try {
      // Validar que a credencial existe
      const credencial = usuarios.find(u => u.user_id === selectedCredential);
      if (!credencial) {
        toast.error("Credencial não encontrada");
        return;
      }

      // DESIGN-ROLE-MESSAGING-ISOLATION-001: Usar rota semântica POST /api/alunos/link-user
      // DESIGN-LINK-ALUNO-USER-001: Rota oficial para vincular usuário a aluno
      await apiClient.request('/api/alunos/link-user', {
        method: 'POST',
        body: JSON.stringify({
          importedAlunoId: selectedAluno.id,
          userIdToLink: selectedCredential
        }),
      });

      console.log("imported_user.link.success", {
        imported_user_id: selectedAluno.id,
        user_id: selectedCredential,
        email: credencial.email
      });

      toast.success("Usuário vinculado com sucesso!");
      setIsLinkDialogOpen(false);
      carregarDados();
    } catch (error: any) {
      console.error("imported_user.link.error", {
        imported_user_id: selectedAluno?.id,
        user_id: selectedCredential,
        error: error.message,
        errorStack: error.stack
      });
      toast.error("Erro ao vincular usuário: " + (error.message || "Erro desconhecido"));
    } finally {
      setLinking(false);
    }
  };

  const getStatusBadge = (aluno: Aluno) => {
    // Usar isLinked() como fonte de verdade, não heurística de '@'
    if (isLinked(aluno)) {
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
        <RefreshCw className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
          <Link2 className="w-6 h-6 text-primary" />
          Vincular Usuários Importados
          {isAdmin && (
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Super Admin — visão global
            </Badge>
          )}
        </h2>
        <p className="text-muted-foreground mt-1">
          Associe fichas importadas às credenciais ou adote cadastros feitos pelo link de convite
        </p>
        {signupInviteUrl && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <code className="text-xs bg-muted px-3 py-2 rounded-md flex-1 truncate">
              {signupInviteUrl}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyInviteLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar link de cadastro
            </Button>
          </div>
        )}
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

      {cadastrosPendentes.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Cadastros na plataforma ({cadastrosPendentes.length})
            </CardTitle>
            <CardDescription>
              Alunos que criaram conta mas ainda não têm ficha.
              {isAdmin ? " Selecione o coach e clique em criar ficha." : " Clique em criar ficha para aparecerem na lista abaixo."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && coaches.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center max-w-md">
                <label className="text-sm font-medium shrink-0">Coach responsável:</label>
                <Select value={adoptCoachId} onValueChange={setAdoptCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar coach" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.email || c.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ScrollArea className="h-[280px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Email confirmado</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cadastrosPendentes.map((reg) => (
                    <TableRow key={reg.user_id}>
                      <TableCell className="font-medium">{reg.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {reg.created_at
                          ? new Date(reg.created_at).toLocaleString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {reg.email_confirmed_at ? (
                          <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                            <Check className="w-3 h-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDismissRegistration(reg)}
                            disabled={dismissingUserId === reg.user_id || adoptingUserId === reg.user_id}
                            title="Remove só o cadastro na plataforma (sem ficha)"
                          >
                            {dismissingUserId === reg.user_id ? (
                              <RefreshCw className="w-4 h-4 motion-safe:animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAdoptRegistration(reg)}
                            disabled={adoptingUserId === reg.user_id || dismissingUserId === reg.user_id}
                          >
                            {adoptingUserId === reg.user_id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1 motion-safe:animate-spin" />
                                Criando...
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-1" />
                                Criar ficha
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {alunos.length === 0 && cadastrosPendentes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Nenhum usuário importado</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Compartilhe o link de cadastro acima ou importe fichas para vincular alunos.
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
                      {isAdmin && <TableHead>Coach</TableHead>}
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
                          {getDisplayName(aluno)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-sm text-muted-foreground">
                            {getCoachLabel(aluno)}
                          </TableCell>
                        )}
                        <TableCell>
                          {aluno.cpf_cnpj || "-"}
                        </TableCell>
                        <TableCell>{getDisplayEmail(aluno)}</TableCell>
                        <TableCell>
                          {getStatusBadge(aluno)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLinked(aluno) ? (
                            // Aluno vinculado: permitir re-vinculação se necessário
                            <div className="flex items-center gap-2 justify-end">
                              <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Vinculado
                              </Badge>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleOpenLinkDialog(aluno)}
                                title="Re-vincular usuário"
                              >
                                <Unlink className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            // Aluno não vinculado: mostrar botão de vincular com select auto-search
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
                  <span className="font-medium">{getDisplayName(selectedAluno)}</span>
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

              {/* Credential Select com busca auto-search usando Combobox */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Selecionar credencial para vínculo
                </label>
                {credenciaisDisponiveis.length === 0 ? (
                  <div className="p-4 border rounded-lg text-center text-sm text-muted-foreground bg-muted/50">
                    <AlertCircle className="w-4 h-4 mx-auto mb-2" />
                    Nenhuma credencial disponível para vínculo
                  </div>
                ) : (
                  <Combobox
                    options={credenciaisDisponiveis.map(cred => ({
                      value: cred.user_id,
                      label: cred.email || `Usuário ${cred.user_id.slice(0, 8)}...`,
                      description: cred.email ? `ID: ${cred.user_id.slice(0, 8)}...` : undefined
                    }))}
                    value={selectedCredential}
                    onSelect={setSelectedCredential}
                    placeholder="Buscar e escolher uma credencial..."
                    searchPlaceholder="Buscar por email..."
                    emptyText="Nenhuma credencial encontrada."
                    className="w-full"
                  />
                )}
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
                  <RefreshCw className="w-4 h-4 mr-2 motion-safe:animate-spin" />
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
