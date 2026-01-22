import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shield, Trash2, User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserWithRole {
  id: string; // user_id do usuário
  user_role_id?: string; // id da tabela user_roles (necessário para atualizar)
  email: string;
  role: "coach" | "aluno";
  created_at: string;
  avatar_url?: string;
  display_name?: string;
}

const UserRolesManager = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Get all users with roles - buscar user_roles e combinar com dados de app_auth.users, alunos e profiles
      const rolesData = await apiClient
        .from("user_roles")
        .select("*");

      const roles = Array.isArray(rolesData) ? rolesData : [];

      // Get all users from app_auth.users to get emails
      // Buscar emails de todos os usuários através do endpoint /auth/user-by-id
      const usersEmailsMap = new Map<string, string>();
      for (const role of roles) {
        try {
          const userData = await apiClient.getUserById(role.user_id);
          if (userData?.email) {
            usersEmailsMap.set(role.user_id, userData.email);
          }
        } catch (err) {
          console.warn(`Não foi possível buscar email para user_id ${role.user_id}:`, err);
        }
      }

      // Get profiles for avatars
      const profilesData = await apiClient
        .from("profiles")
        .select("id, avatar_url");

      const profiles = Array.isArray(profilesData) ? profilesData : [];
      const profilesMap = new Map(
        profiles.map((p) => [p.id, p.avatar_url])
      );

      // Get alunos data for display names
      const alunosData = await apiClient
        .from("alunos")
        .select("id, email, nome");

      const alunos = Array.isArray(alunosData) ? alunosData : [];
      const alunosNameMap = new Map<string, string>();
      alunos.forEach((a) => {
        if (a.email && a.nome) {
          alunosNameMap.set(a.email.toLowerCase(), a.nome);
        }
      });

      // Map users data - combinando user_roles com dados de app_auth.users, alunos e profiles
      const usersWithRoles: UserWithRole[] = roles.map((role: any) => {
        // Buscar email do app_auth.users
        // IMPORTANTE: Se não encontrar email, deixar como undefined para que seja buscado novamente
        const email = usersEmailsMap.get(role.user_id) || undefined;
        
        // Buscar nome do aluno correspondente pelo email
        const displayName = email && email.includes('@') 
          ? alunosNameMap.get(email.toLowerCase()) || undefined
          : undefined;
        
        // Se não tiver email nem nome, usar fallback mais legível
        // Mas sempre priorizar email real se existir
        
        return {
          id: role.user_id, // user_id para identificação do usuário
          user_role_id: role.id, // id da tabela user_roles para atualização
          email: email || 'email@não.encontrado', // Garantir que sempre haja um email (mesmo que fallback)
          role: role.role,
          created_at: role.created_at || new Date().toISOString(),
          avatar_url: profilesMap.get(role.user_id) || undefined,
          display_name: displayName,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários: " + (error.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "coach" | "aluno") => {
    // Guard clause: Prevenir alteração do próprio papel
    if (userId === user?.id) {
      toast.error("Você não pode alterar seu próprio papel");
      console.warn("user_roles.update.blocked_self_change", { userId, newRole });
      return;
    }

    // Buscar usuário atual e validar estado
    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) {
      toast.error("Usuário não encontrado");
      console.error("user_roles.update.blocked_user_not_found", { userId });
      return;
    }

    // Guard clause: Prevenir rebaixamento do último coach
    if (currentUser.role === "coach" && newRole === "aluno") {
      const coachesCount = users.filter((u) => u.role === "coach").length;
      if (coachesCount <= 1) {
        toast.error("Não é possível rebaixar o último coach do sistema. Promova outro usuário a coach primeiro.");
        console.warn("user_roles.update.blocked_last_coach", { userId, coachesCount });
        return;
      }
    }

    // Guard clause: Validar que user_role_id existe ANTES de fazer a requisição
    // O backend exige id no payload - não podemos prosseguir sem ele
    if (!currentUser.user_role_id) {
      const errorMsg = "Erro: ID do role não encontrado. Recarregue a página e tente novamente.";
      toast.error(errorMsg);
      console.error("user_roles.update.blocked_missing_id", {
        userId,
        currentUser,
        error: "user_role_id is undefined"
      });
      return;
    }

    // Validar formato UUID básico (opcional, mas ajuda a detectar problemas cedo)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(currentUser.user_role_id)) {
      const errorMsg = "Erro: ID do role inválido. Recarregue a página e tente novamente.";
      toast.error(errorMsg);
      console.error("user_roles.update.blocked_invalid_id", {
        userId,
        user_role_id: currentUser.user_role_id
      });
      return;
    }

    setUpdating(userId);
    try {
      // Contrato da API: PATCH /rest/v1/user_roles { id: string, role: "coach" | "aluno" }
      // O backend exige que o 'id' esteja no payload do body
      // NUNCA usar .eq() para filtro - sempre enviar id diretamente no body
      console.log("user_roles.update.submit", {
        userId,
        user_role_id: currentUser.user_role_id,
        newRole,
        oldRole: currentUser.role
      });

      await apiClient
        .from("user_roles")
        .update({ id: currentUser.user_role_id, role: newRole });

      // Atualizar estado local apenas após sucesso
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast.success(
        `Papel alterado para ${newRole === "coach" ? "Coach" : "Aluno"} com sucesso!`
      );

      console.log("user_roles.update.success", {
        userId,
        user_role_id: currentUser.user_role_id,
        newRole
      });
    } catch (error: any) {
      // Log estruturado para diagnóstico em produção
      console.error("user_roles.update.error", {
        userId,
        user_role_id: currentUser.user_role_id,
        newRole,
        error: error.message,
        errorStack: error.stack,
        requestId: error.requestId // Se o backend incluir requestId no erro
      });
      
      toast.error("Erro ao atualizar papel: " + (error.message || "Erro desconhecido"));
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Prevent deleting yourself
    if (userToDelete.id === user?.id) {
      toast.error("Você não pode excluir a si mesmo");
      setUserToDelete(null);
      return;
    }

    // Prevent deleting the last coach
    if (userToDelete.role === "coach") {
      const coachesCount = users.filter((u) => u.role === "coach").length;
      if (coachesCount <= 1) {
        toast.error("Não é possível excluir o último coach do sistema.");
        setUserToDelete(null);
        return;
      }
    }

    setDeleting(userToDelete.id);
    try {
      // IMPORTANTE: Usar user_role_id para deletar completamente (incluindo app_auth.users)
      // O endpoint DELETE /rest/v1/user_roles agora remove o usuário completamente
      if (!userToDelete.user_role_id) {
        toast.error("Erro: ID do role não encontrado para exclusão");
        return;
      }

      // Delete user role (isso vai deletar tudo: user_roles, profiles, alunos e app_auth.users)
      // Usar delete com ID direto ao invés de filtros
      await apiClient
        .from("user_roles")
        .delete(userToDelete.user_role_id);

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`Usuário "${userToDelete.display_name || userToDelete.email}" excluído com sucesso!`);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao excluir usuário: " + error.message);
    } finally {
      setDeleting(null);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const coachCount = users.filter((u) => u.role === "coach").length;
  const alunoCount = users.filter((u) => u.role === "aluno").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Papéis de Usuários</h2>
        <p className="text-muted-foreground">
          Defina quem é coach (administrador) e quem é aluno no sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coaches</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{coachCount}</div>
            <p className="text-xs text-muted-foreground">
              Podem gerenciar alunos, dietas, treinos e pagamentos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alunos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunoCount}</div>
            <p className="text-xs text-muted-foreground">
              Acesso ao portal do aluno
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>
            Altere o papel de cada usuário para definir suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel Atual</TableHead>
                  <TableHead>Alterar Para</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm
                        ? "Nenhum usuário encontrado com esses critérios"
                        : "Nenhum usuário cadastrado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.display_name?.charAt(0)?.toUpperCase() ||
                                u.email?.charAt(0)?.toUpperCase() ||
                                '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {/* Prioridade: nome > email (sem @ se necessário) > email completo (nunca mostrar ID) */}
                              {u.display_name || 
                               (u.email && u.email.includes('@') ? u.email.split('@')[0] : u.email) || 
                               'Usuário sem email'}
                              {u.id === user?.id && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Você
                                </Badge>
                              )}
                            </p>
                            {/* Exibir email completo como subtítulo se tiver nome OU se o display for diferente do email */}
                            {(u.display_name && u.email && u.email.includes('@')) || 
                             (u.email && u.email.includes('@') && !u.display_name && u.email.split('@')[0] !== u.email) ? (
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "coach" ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {u.role === "coach" ? (
                            <>
                              <Shield className="h-3 w-3" />
                              Coach
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" />
                              Aluno
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(value: "coach" | "aluno") =>
                            handleRoleChange(u.id, value)
                          }
                          disabled={updating === u.id || u.id === user?.id}
                        >
                          <SelectTrigger className="w-32">
                            {updating === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="coach">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3" />
                                Coach
                              </div>
                            </SelectItem>
                            <SelectItem value="aluno">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                Aluno
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={u.id === user?.id || deleting === u.id}
                          onClick={() => setUserToDelete(u)}
                        >
                          {deleting === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sobre os Papéis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>Coach</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Gerenciar alunos</li>
                <li>Criar e editar dietas</li>
                <li>Criar e atribuir treinos</li>
                <li>Gerenciar planos de pagamento</li>
                <li>Acessar dashboard administrativo</li>
                <li>Enviar mensagens e avisos</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge variant="secondary">Aluno</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Visualizar seus treinos</li>
                <li>Visualizar sua dieta</li>
                <li>Enviar check-ins semanais</li>
                <li>Visualizar seus pagamentos</li>
                <li>Enviar mensagens ao coach</li>
                <li>Acessar vídeos educativos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{userToDelete?.display_name || userToDelete?.email}</strong>?
              <br /><br />
              Esta ação irá remover:
              <ul className="list-disc ml-4 mt-2">
                <li>Papel do usuário no sistema</li>
                <li>Perfil e avatar</li>
                <li>Dados do aluno (se aplicável)</li>
              </ul>
              <br />
              <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserRolesManager;