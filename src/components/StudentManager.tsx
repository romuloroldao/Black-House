import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { useApiSafeList } from "@/hooks/useApiSafe";
import { API_CONTRACT } from "@/contracts/api-contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Mail, 
  Phone, 
  Calendar,
  Target,
  TrendingUp,
  CreditCard,
  MessageSquare,
  Edit,
  Trash2,
  UserPlus,
  Users,
  Eye,
  Link2,
  Upload
} from "lucide-react";
import StudentImporter from "./StudentImporter";

interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf_cnpj?: string;
  avatar?: string;
  status: string;
  plan: string;
  goal?: string;
  joinDate: string;
  lastWorkout: string;
  progress: number;
  payment: string;
  tags: string[];
  nextPayment: string;
  data_nascimento?: string;
  peso?: number;
}

const StudentManager = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const coachEndpoint = user?.id ? API_CONTRACT.alunos.byCoach() : undefined;
  
  // REACT-API-RESILIENCE-FIX-008: Usar hook resiliente para alunos
  const { data: alunosRaw, loading: loadingAlunos, error: errorAlunos, refetch: refetchAlunos } = useApiSafeList(
    () => apiClient.getAlunosByCoachSafe(),
    { autoFetch: isReady, endpointKey: coachEndpoint, availabilityKey: 'alunosByCoach' } // Só buscar quando DataContext estiver pronto
  );
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGoal, setFilterGoal] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<Array<{ id: string; nome: string }>>([]);
  const [coachEmail, setCoachEmail] = useState<string>("");
  
  // Form states
  const [newStudent, setNewStudent] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf_cnpj: "",
    objetivo: "",
    plano: "",
    data_nascimento: "",
    peso: "",
    dia_cobranca: ""
  });

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - componente NÃO renderiza fora de READY
  if (!isReady) {
    return null;
  }

  // REACT-API-RESILIENCE-FIX-008: Processar alunos quando carregarem
  useEffect(() => {
    if (!loadingAlunos && alunosRaw.length > 0) {
      // Get emails of all users with 'coach' role to exclude them from student list
      let coachEmails: string[] = [];

      // Filter out any alunos whose email matches a coach's email
      let filteredData = alunosRaw.filter(aluno => 
        !coachEmails.includes(aluno.email?.toLowerCase())
      );

      const alunosFormatados: Student[] = filteredData.map(aluno => {
        const alunoId = aluno?.id || '';
        const alunoNome = aluno?.nome || 'Sem nome';
        const alunoEmail = aluno?.email || '';
        const alunoTelefone = aluno?.telefone;
        const alunoCpfCnpj = aluno?.cpf_cnpj;
        const alunoPlano = aluno?.plano || 'Básico';
        const alunoObjetivo = aluno?.objetivo || 'Sem objetivo definido';
        const alunoCreatedAt = aluno?.created_at;
        const alunoDataNascimento = aluno?.data_nascimento;
        const alunoPeso = aluno?.peso;

        let joinDate = 'Data não disponível';
        try {
          if (alunoCreatedAt) {
            joinDate = new Date(alunoCreatedAt).toLocaleDateString('pt-BR');
          }
        } catch (e) {
          console.warn('[DESIGN-023] Erro ao parsear data:', e);
        }

        return {
          id: alunoId,
          name: alunoNome,
          email: alunoEmail,
          phone: alunoTelefone || undefined,
          cpf_cnpj: alunoCpfCnpj || undefined,
          avatar: '/api/placeholder/60/60',
          status: 'active',
          plan: alunoPlano,
          goal: alunoObjetivo,
          joinDate,
          lastWorkout: 'Não registrado',
          progress: 0,
          payment: alunoCpfCnpj ? 'paid' : 'pending',
          tags: [],
          nextPayment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          data_nascimento: alunoDataNascimento,
          peso: alunoPeso
        };
      });

      setStudents(alunosFormatados);
      setLoading(false);
    } else if (!loadingAlunos) {
      setStudents([]);
      setLoading(false);
    }
  }, [alunosRaw, loadingAlunos]);

  // Carregar email do coach
  useEffect(() => {
    if (!isReady || !user) return;
    setCoachEmail(user.email || "");
  }, [isReady, user]);

  const handleSaveStudent = async () => {
    try {
      if (!newStudent.nome || !newStudent.email || !newStudent.cpf_cnpj) {
        toast({
          title: "Campos obrigatórios",
          description: "Nome, Email e CPF/CNPJ são obrigatórios. O CPF/CNPJ é necessário para gerar cobranças.",
          variant: "destructive",
        });
        return;
      }

      // Validar dia de cobrança
      if (newStudent.dia_cobranca) {
        const dia = parseInt(newStudent.dia_cobranca);
        if (isNaN(dia) || dia < 1 || dia > 31) {
          toast({
            title: "Dia de cobrança inválido",
            description: "O dia de cobrança deve ser um número entre 1 e 31.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      let alunoId = editingStudent?.id;

      if (editingStudent) {
        const updateResult = await apiClient.requestSafe(`/api/alunos/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nome: newStudent.nome,
            email: newStudent.email,
            cpf_cnpj: newStudent.cpf_cnpj,
            telefone: newStudent.telefone || null,
            objetivo: newStudent.objetivo || null,
            plano: newStudent.plano || null,
            data_nascimento: newStudent.data_nascimento || null,
            peso: newStudent.peso ? parseInt(newStudent.peso) : null,
            coach_id: user.id,
          }),
        });
        if (!updateResult.success) {
          toast({
            title: "Erro",
            description: "Não foi possível atualizar o aluno",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Sucesso!",
          description: "Aluno atualizado com sucesso",
        });
      } else {
        const insertResult = await apiClient.requestSafe<any>('/api/alunos', {
          method: 'POST',
          body: JSON.stringify({
            nome: newStudent.nome,
            email: newStudent.email,
            cpf_cnpj: newStudent.cpf_cnpj,
            telefone: newStudent.telefone || null,
            objetivo: newStudent.objetivo || null,
            plano: newStudent.plano || null,
            data_nascimento: newStudent.data_nascimento || null,
            peso: newStudent.peso ? parseInt(newStudent.peso) : null,
            coach_id: user.id,
          }),
        });
        if (!insertResult.success) {
          toast({
            title: "Erro",
            description: "Não foi possível adicionar o aluno",
            variant: "destructive",
          });
          return;
        }
        alunoId = insertResult.data?.id || null;
        toast({
          title: "Sucesso!",
          description: "Aluno adicionado com sucesso",
        });
      }

      // Se o aluno tem um plano associado, criar/atualizar configuração de cobrança recorrente
      if (newStudent.plano && alunoId) {
        const configsResult = await apiClient.requestSafe<any[]>(`/api/recurring-charges-config?aluno_id=${alunoId}`);
        const configs = configsResult.success && Array.isArray(configsResult.data) ? configsResult.data : [];
        const existingConfig = configs.length > 0 ? configs[0] : null;

        const diaCobranca = newStudent.dia_cobranca ? parseInt(newStudent.dia_cobranca) : null;

        if (!existingConfig) {
          const createResult = await apiClient.requestSafe('/api/recurring-charges-config', {
            method: 'POST',
            body: JSON.stringify({
              aluno_id: alunoId,
              payment_plan_id: newStudent.plano,
              coach_id: user.id,
              dia_vencimento_customizado: diaCobranca,
              ativo: true,
            }),
          });
          if (createResult.success) {
            toast({
              title: "Cobrança configurada!",
              description: "Cobrança recorrente ativada para este aluno",
            });
          } else {
            toast({
              title: "Atenção",
              description: "Aluno salvo, mas houve erro ao criar configuração de cobrança automática",
              variant: "destructive",
            });
          }
        } else {
          await apiClient.requestSafe(`/api/recurring-charges-config/${existingConfig.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              payment_plan_id: newStudent.plano,
              dia_vencimento_customizado: diaCobranca,
            }),
          });
        }
      }

      // Reset form
      setNewStudent({
        nome: "",
        email: "",
        telefone: "",
        cpf_cnpj: "",
        objetivo: "",
        plano: "",
        data_nascimento: "",
        peso: "",
        dia_cobranca: ""
      });
      
      setEditingStudent(null);
      setIsDialogOpen(false);
      // REACT-API-RESILIENCE-FIX-008: Recarregar alunos após salvar
      refetchAlunos();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      toast({
        title: "Erro",
        description: editingStudent ? "Não foi possível atualizar o aluno" : "Não foi possível adicionar o aluno",
        variant: "destructive",
      });
    }
  };

  const handleEditStudent = async (student: Student) => {
    setEditingStudent(student);
    
    // Find plan ID - student.plan might be either the plan ID or plan name
    let planId = "";
    if (student.plan) {
      // Try to find plan by ID first
      const planById = paymentPlans.find(p => p.id === student.plan);
      if (planById) {
        planId = planById.id;
      } else {
        // If not found, try to find by name
        const planByName = paymentPlans.find(p => p.nome === student.plan);
        if (planByName) {
          planId = planByName.id;
        }
      }
    }

    // Buscar configuração de cobrança para obter dia_vencimento_customizado
    let diaCobranca = "";
    const configResult = await apiClient.requestSafe<any[]>(`/api/recurring-charges-config?aluno_id=${student.id}&ativo=true`);
    const configData = configResult.success && Array.isArray(configResult.data) && configResult.data.length > 0
      ? configResult.data[0]
      : null;

    if (configData) {
      diaCobranca = configData.dia_vencimento_customizado?.toString() || "";
      if (configData.payment_plan_id) {
        planId = configData.payment_plan_id;
      }
    }
    
    setNewStudent({
      nome: student.name,
      email: student.email,
      telefone: student.phone || "",
      cpf_cnpj: student.cpf_cnpj || "",
      objetivo: student.goal || "",
      plano: planId,
      data_nascimento: student.data_nascimento || "",
      peso: student.peso?.toString() || "",
      dia_cobranca: diaCobranca
    });
    setIsDialogOpen(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Tem certeza que deseja deletar este aluno?")) {
      return;
    }

    const deleteResult = await apiClient.requestSafe(`/api/alunos/${studentId}`, { method: 'DELETE' });
    if (!deleteResult.success) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o aluno.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Aluno deletado!",
      description: "O aluno foi removido com sucesso.",
    });

    refetchAlunos();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary text-primary-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentColor = (payment: string) => {
    switch (payment) {
      case 'paid': return 'bg-primary text-primary-foreground';
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPlanColor = (plan: string) => {
    // Retorna uma cor padrão para todos os planos
    return 'bg-primary/80 text-primary-foreground';
  };

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - nunca executar .filter em dados possivelmente undefined
  const filteredStudents = (Array.isArray(students) ? students : []).filter(student => {
    // DESIGN-023: Optional chaining para acessos profundos
    const studentName = student?.name || '';
    const studentEmail = student?.email || '';
    const studentStatus = student?.status || '';
    const studentGoal = student?.goal || '';
    
    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         studentEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || studentStatus === filterStatus;
    const matchesGoal = filterGoal === "all" || studentGoal === filterGoal;
    
    return matchesSearch && matchesStatus && matchesGoal;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // REACT-API-RESILIENCE-FIX-008: UI de erro
  if (errorAlunos) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardContent className="p-12 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Alert className="text-destructive text-4xl">!</Alert>
              </div>
              <h3 className="text-lg font-semibold mb-2">Erro ao carregar alunos</h3>
              <p className="text-sm text-muted-foreground mb-6">{errorAlunos}</p>
            </div>
            <Button onClick={refetchAlunos} variant="outline">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Alunos</h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus alunos em um só lugar
          </p>
        </div>
        <div className="flex gap-2">
          {/* Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg">
                <Upload className="w-5 h-5 mr-2" />
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importar Aluno</DialogTitle>
                <DialogDescription>
                  Faça upload de um PDF com os dados do aluno para importação automática
                </DialogDescription>
              </DialogHeader>
              <StudentImporter 
                onClose={() => setIsImportDialogOpen(false)}
                onImportComplete={() => carregarAlunos()}
              />
            </DialogContent>
          </Dialog>

          {/* Add Student Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
            setEditingStudent(null);
              setNewStudent({
                nome: "",
                email: "",
                telefone: "",
                cpf_cnpj: "",
                objetivo: "",
                plano: "",
                data_nascimento: "",
                peso: "",
                dia_cobranca: ""
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="premium" size="lg">
                <UserPlus className="w-5 h-5 mr-2" />
                Novo Aluno
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                * Campos obrigatórios. O CPF/CNPJ é necessário para gerar cobranças via Asaas.
              </p>
            </DialogHeader>
            
            {/* Coach Link Badge */}
            <Alert className="border-primary/20 bg-primary/5">
              <Link2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <span className="font-medium">Vínculo automático:</span> Este aluno será vinculado à sua conta ({coachEmail})
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 py-4">
              <Input 
                placeholder="Nome completo *" 
                value={newStudent.nome}
                onChange={(e) => setNewStudent({...newStudent, nome: e.target.value})}
              />
              <Input 
                placeholder="Email *" 
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
              />
              <Input 
                placeholder="Telefone" 
                value={newStudent.telefone}
                onChange={(e) => setNewStudent({...newStudent, telefone: e.target.value})}
              />
              <Input 
                placeholder="CPF ou CNPJ *" 
                value={newStudent.cpf_cnpj}
                onChange={(e) => setNewStudent({...newStudent, cpf_cnpj: e.target.value})}
              />
              <Select
                value={newStudent.objetivo}
                onValueChange={(value) => setNewStudent({...newStudent, objetivo: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                  <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                  <SelectItem value="Condicionamento">Condicionamento</SelectItem>
                  <SelectItem value="Reabilitação">Reabilitação</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={newStudent.plano}
                onValueChange={(value) => setNewStudent({...newStudent, plano: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  {paymentPlans.length > 0 ? (
                    paymentPlans.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="Nenhum" disabled>
                      Nenhum plano cadastrado
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Peso (kg)" 
                type="number"
                value={newStudent.peso}
                onChange={(e) => setNewStudent({...newStudent, peso: e.target.value})}
              />
              <Input 
                placeholder="Data de nascimento" 
                type="date"
                value={newStudent.data_nascimento}
                onChange={(e) => setNewStudent({...newStudent, data_nascimento: e.target.value})}
              />
              <Input 
                placeholder="Dia de cobrança (1-31)" 
                type="number"
                min="1"
                max="31"
                value={newStudent.dia_cobranca}
                onChange={(e) => setNewStudent({...newStudent, dia_cobranca: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setEditingStudent(null);
              }}>
                Cancelar
              </Button>
              <Button variant="premium" onClick={handleSaveStudent}>
                {editingStudent ? "Atualizar Aluno" : "Salvar Aluno"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGoal} onValueChange={setFilterGoal}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Objetivos</SelectItem>
                <SelectItem value="Emagrecimento">Emagrecimento</SelectItem>
                <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                <SelectItem value="Condicionamento">Condicionamento</SelectItem>
                <SelectItem value="Reabilitação">Reabilitação</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students Grid */}
      {/* DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - verificar array antes de .map */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.isArray(filteredStudents) && filteredStudents.length > 0 ? (
          filteredStudents.map((student) => {
            // DESIGN-023: Optional chaining para acessos profundos
            const studentId = student?.id || '';
            const studentName = student?.name || 'Sem nome';
            const studentEmail = student?.email || '';
            const studentAvatar = student?.avatar;
            const studentStatus = student?.status || 'active';
            const studentPlan = student?.plan || '';
            const studentGoal = student?.goal || '';
            const studentProgress = typeof student?.progress === 'number' ? student.progress : 0;
            const studentLastWorkout = student?.lastWorkout || 'Não registrado';
            const studentPayment = student?.payment || 'pending';
            const studentTags = Array.isArray(student?.tags) ? student.tags : [];

            // DESIGN-023: Safe string operations
            const initials = studentName
              ? studentName.split(' ').map((n: string) => n?.[0] || '').join('').toUpperCase().slice(0, 2)
              : '??';

            return (
              <Card key={studentId} className="bg-gradient-card border-0 shadow-card hover:shadow-elevated transition-smooth">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={studentAvatar} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">{studentName}</h3>
                        <p className="text-sm text-muted-foreground">{studentEmail}</p>
                      </div>
                    </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status and Plan */}
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(studentStatus)}>
                  {studentStatus === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
                <Badge className={getPlanColor(studentPlan)}>
                  {studentPlan}
                </Badge>
              </div>

              {/* Goal and Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Objetivo:</span>
                  <span className="font-medium">{studentGoal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso:</span>
                  <span className="font-medium">{studentProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-gradient-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, studentProgress))}%` }}
                  />
                </div>
              </div>

              {/* Last Workout */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Último treino:</span>
                <span className="font-medium">{studentLastWorkout}</span>
              </div>

              {/* Payment Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pagamento:</span>
                <Badge className={getPaymentColor(studentPayment)}>
                  {studentPayment === 'paid' ? 'Em dia' : 
                   studentPayment === 'overdue' ? 'Vencido' : 'Pendente'}
                </Badge>
              </div>

              {/* Tags */}
              {/* DESIGN-023: Guard defensivo - verificar array antes de .map */}
              {studentTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {studentTags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag || ''}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`/alunos/${studentId}`)}
                >
                  <Eye className="w-4 h-4" />
                  Ver detalhes
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEditStudent(student)}
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDeleteStudent(studentId)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
            );
          })
        ) : (
          <Card className="bg-gradient-card border-0 shadow-card col-span-full">
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum aluno encontrado</h3>
              <p className="text-muted-foreground mb-6">
                Ajuste os filtros ou adicione um novo aluno para começar
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty State - DESIGN-023: Removido duplicado, já tratado acima */}
      {Array.isArray(filteredStudents) && filteredStudents.length === 0 && (
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum aluno encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Ajuste os filtros ou adicione um novo aluno para começar
            </p>
            <Button variant="premium">
              <UserPlus className="w-5 h-5" />
              Adicionar Primeiro Aluno
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentManager;