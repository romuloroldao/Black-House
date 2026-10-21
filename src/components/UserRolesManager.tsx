import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Search, Shield, Trash2, User, Users, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserRole = "coach" | "aluno" | "assistant" | "admin";

interface UserWithRole {
  id: string;
  user_role_id: string;
  email: string;
  role: UserRole;
  created_at: string;
  avatar_url?: string;
  display_name?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  coach: "Coach",
  aluno: "Aluno",
  assistant: "Assistente",
  admin: "Admin",
};

function formatRoleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
      const rolesResult = await apiClient.requestSafe<
        Array<{
          id: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
          email?: string;
          avatar_url?: string;
          display_name?: string;
        }>
      >("/api/user-roles");

      const roles = rolesResult.success && Array.isArray(rolesResult.data) ? rolesResult.data : [];

      const usersWithRoles: UserWithRole[] = roles.map((role) => ({
        id: role.user_id,
        user_role_id: role.id,
        email: role.email?.trim() || "email@não.encontrado",
        role: role.role,
        created_at: role.created_at || new Date().toISOString(),
        avatar_url: role.avatar_url || undefined,
        display_name: role.display_name?.trim() || undefined,
      }));

      setUsers(usersWithRoles);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "coach" | "aluno") => {
    if (userId === user?.id) {
      toast.error("Você não pode alterar seu próprio papel");
      return;
    }

    const currentUser = users.find((u) => u.id === userId);
    if (!currentUser) {
      toast.error("Usuário não encontrado");
      return;
    }

    if (currentUser.role === newRole) {
      return;
    }

    if (currentUser.role === "admin") {
      toast.error("Papel de admin só pode ser alterado por outro super admin");
      return;
    }

    if (currentUser.role === "assistant") {
      toast.error("Assistentes são geridos em Configurações → Equipa. Promova a Coach aqui após remover da equipa.");
      return;
    }

    if (currentUser.role === "coach" && newRole === "aluno") {
      const coachesCount = users.filter((u) => u.role === "coach").length;
      if (coachesCount <= 1) {
        toast.error("Não é possível rebaixar o último coach do sistema. Promova outro usuário a coach primeiro.");
        return;
      }
    }

    setUpdating(userId);
    try {
      const updateResult = await apiClient.requestSafe(`/api/user-roles/${currentUser.user_role_id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      if (!updateResult.success) {
        throw new Error(updateResult.error || "Erro ao atualizar papel");
      }

      const payload = updateResult.data as { aluno_conflict?: boolean } | undefined;
      if (payload?.aluno_conflict) {
        toast.warning(
          "Papel alterado, mas ainda existe ficha de aluno com este email. Remova-a na Gestão de Alunos.",
        );
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

      toast.success(
        `Papel alterado para ${ROLE_LABELS[newRole]}.${
          newRole === "coach" ? " O utilizador deve sair e voltar a entrar para aplicar o acesso ao painel." : ""
        }`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao atualizar papel: " + message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.id === user?.id) {
      toast.error("Você não pode excluir a si mesmo");
      setUserToDelete(null);
      return;
    }

    if (userToDelete.role === "coach") {
      const coachesCount = users.filter((u) => u.role === "coach").length;
      if (coachesCount <= 1) {
        toast.error("Não é possível excluir o último coach do sistema.");
        setUserToDelete(null);
        return;
      }
    }

    if (userToDelete.role === "admin") {
      toast.error("Não é possível excluir um administrador por esta tela.");
      setUserToDelete(null);
      return;
    }

    setDeleting(userToDelete.id);
    try {
      const deleteResult = await apiClient.requestSafe(`/api/user-roles/${userToDelete.user_role_id}`, {
        method: "DELETE",
      });
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || "Erro ao excluir usuário");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      toast.success(`Usuário "${userToDelete.display_name || userToDelete.email}" excluído com sucesso!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao excluir usuário: " + message);
    } finally {
      setDeleting(null);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const stats = useMemo(() => {
    const coachCount = users.filter((u) => u.role === "coach").length;
    const alunoCount = users.filter((u) => u.role === "aluno").length;
    const assistantCount = users.filter((u) => u.role === "assistant").length;
    const adminCount = users.filter((u) => u.role === "admin").length;
    return { coachCount, alunoCount, assistantCount, adminCount, total: users.length };
  }, [users]);

  const renderRoleControl = (u: UserWithRole) => {
    if (u.id === user?.id) {
      return (
        <span className="text-sm text-muted-foreground">
          {ROLE_LABELS[u.role]} (você)
        </span>
      );
    }

    if (u.role === "admin") {
      return <span className="text-sm text-muted-foreground">Protegido</span>;
    }

    if (u.role === "assistant") {
      return (
        <span className="text-sm text-muted-foreground">
          Gerido em Equipa
        </span>
      );
    }

    return (
      <Select
        value={u.role === "coach" || u.role === "aluno" ? u.role : "aluno"}
        onValueChange={(value: "coach" | "aluno") => handleRoleChange(u.id, value)}
        disabled={updating === u.id}
      >
        <SelectTrigger className="w-[140px]">
          {updating === u.id ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
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
    );
  };

  const roleBadgeVariant = (role: UserRole) => {
    if (role === "coach") return "default";
    if (role === "admin") return "default";
    if (role === "assistant") return "outline";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Papéis de Usuários</h2>
        <p className="text-muted-foreground">
          Defina quem é coach titular e quem é aluno. Assistentes de equipa são geridos em{" "}
          <span className="text-foreground">Configurações → Equipa</span>.
        </p>
      </div>

      <div className={`grid gap-4 ${stats.adminCount > 0 || stats.assistantCount > 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            {(stats.adminCount > 0 || stats.assistantCount > 0) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[
                  stats.adminCount > 0 ? `${stats.adminCount} admin` : null,
                  stats.assistantCount > 0 ? `${stats.assistantCount} assistente(s)` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coaches</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.coachCount}</div>
            <p className="text-xs text-muted-foreground">
              Acesso completo ao painel administrativo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alunos</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alunoCount}</div>
            <p className="text-xs text-muted-foreground">Portal do aluno</p>
          </CardContent>
        </Card>
        {(stats.adminCount > 0 || stats.assistantCount > 0) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outros papéis</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.adminCount + stats.assistantCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Admin e assistentes de equipa
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>
            {filteredUsers.length === users.length
              ? `${users.length} utilizadores com papel definido`
              : `${filteredUsers.length} de ${users.length} utilizadores`}
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

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Alterar papel</TableHead>
                  <TableHead>Papel desde</TableHead>
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
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.display_name?.charAt(0)?.toUpperCase() ||
                                u.email?.charAt(0)?.toUpperCase() ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {u.display_name ||
                                (u.email.includes("@") ? u.email.split("@")[0] : u.email)}
                              {u.id === user?.id && (
                                <Badge variant="outline" className="ml-2 text-xs shrink-0">
                                  Você
                                </Badge>
                              )}
                            </p>
                            {u.email.includes("@") && (
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)} className="gap-1 whitespace-nowrap">
                          {u.role === "coach" || u.role === "admin" || u.role === "assistant" ? (
                            <Shield className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{renderRoleControl(u)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatRoleDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={
                            u.id === user?.id ||
                            deleting === u.id ||
                            u.role === "admin"
                          }
                          onClick={() => setUserToDelete(u)}
                        >
                          {deleting === u.id ? (
                            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
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

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sobre os Papéis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge>Coach</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Painel administrativo completo</li>
                <li>Gestão dos próprios alunos</li>
                <li>Dietas, treinos e pagamentos</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge variant="outline">Assistente</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Adicionado em Configurações → Equipa</li>
                <li>Acesso partilhado ao coach titular</li>
                <li>Para titular, promova a Coach nesta tela</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Badge variant="secondary">Aluno</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Portal do aluno (treinos, dieta, check-ins)</li>
                <li>Sem acesso ao painel do coach</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{userToDelete?.display_name || userToDelete?.email}</strong>?
              <br />
              <br />
              Esta ação irá remover o papel, perfil e dados de aluno associados.
              <br />
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
