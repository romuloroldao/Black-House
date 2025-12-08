import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shield, User, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserWithRole {
  id: string;
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

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;

      // Get profiles for avatars
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, avatar_url");

      const profilesMap = new Map(
        profilesData?.map((p) => [p.id, p.avatar_url]) || []
      );

      // Get alunos data for emails
      const { data: alunosData } = await supabase
        .from("alunos")
        .select("id, email, nome");

      const alunosMap = new Map(
        alunosData?.map((a) => [a.id, { email: a.email, nome: a.nome }]) || []
      );

      // Map roles to user data
      const usersWithRoles: UserWithRole[] = (rolesData || []).map((role) => {
        const alunoInfo = alunosMap.get(role.user_id);
        return {
          id: role.user_id,
          email: alunoInfo?.email || role.user_id,
          role: role.role,
          created_at: role.created_at,
          avatar_url: profilesMap.get(role.user_id) || undefined,
          display_name: alunoInfo?.nome || undefined,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "coach" | "aluno") => {
    // Prevent changing own role
    if (userId === user?.id) {
      toast.error("Você não pode alterar seu próprio papel");
      return;
    }

    // Prevent demoting the last coach
    const currentUser = users.find((u) => u.id === userId);
    if (currentUser?.role === "coach" && newRole === "aluno") {
      const coachesCount = users.filter((u) => u.role === "coach").length;
      if (coachesCount <= 1) {
        toast.error("Não é possível rebaixar o último coach do sistema. Promova outro usuário a coach primeiro.");
        return;
      }
    }

    setUpdating(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast.success(
        `Papel alterado para ${newRole === "coach" ? "Coach" : "Aluno"} com sucesso!`
      );
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar papel: " + error.message);
    } finally {
      setUpdating(null);
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
                  <TableHead className="text-right">Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                                u.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {u.display_name || u.email}
                              {u.id === user?.id && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Você
                                </Badge>
                              )}
                            </p>
                            {u.display_name && (
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            )}
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
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
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
    </div>
  );
};

export default UserRolesManager;
