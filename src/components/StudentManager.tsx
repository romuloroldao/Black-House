import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Eye
} from "lucide-react";

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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGoal, setFilterGoal] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<Array<{ id: string; nome: string }>>([]);
  
  // Form states
  const [newStudent, setNewStudent] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf_cnpj: "",
    objetivo: "",
    plano: "",
    data_nascimento: "",
    peso: ""
  });

  useEffect(() => {
    carregarAlunos();
    carregarPlanos();
  }, []);

  const carregarPlanos = async () => {
    try {
      // Get current user to filter only their plans
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('payment_plans')
        .select('id, nome')
        .eq('coach_id', user.id)
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      setPaymentPlans(data || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const carregarAlunos = async () => {
    try {
      // Get current user to filter only their students
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const alunosFormatados: Student[] = data?.map(aluno => ({
        id: aluno.id,
        name: aluno.nome || 'Sem nome',
        email: aluno.email,
        phone: aluno.telefone || undefined,
        cpf_cnpj: aluno.cpf_cnpj || undefined,
        avatar: '/api/placeholder/60/60',
        status: 'active',
        plan: aluno.plano || 'Básico',
        goal: aluno.objetivo || 'Sem objetivo definido',
        joinDate: new Date(aluno.created_at).toLocaleDateString('pt-BR'),
        lastWorkout: 'Não registrado',
        progress: 0,
        payment: aluno.cpf_cnpj ? 'paid' : 'pending',
        tags: [],
        nextPayment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        data_nascimento: aluno.data_nascimento || undefined,
        peso: aluno.peso || undefined
      })) || [];

      setStudents(alunosFormatados);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
    } finally {
      setLoading(false);
    }
  };

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

      // Get current user (coach)
      const { data: { user } } = await supabase.auth.getUser();
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
        // Update existing student - always update coach_id
        const { error } = await supabase
          .from('alunos')
          .update({
            nome: newStudent.nome,
            email: newStudent.email,
            cpf_cnpj: newStudent.cpf_cnpj,
            telefone: newStudent.telefone || null,
            objetivo: newStudent.objetivo || null,
            plano: newStudent.plano || null,
            data_nascimento: newStudent.data_nascimento || null,
            peso: newStudent.peso ? parseInt(newStudent.peso) : null,
            coach_id: user.id, // Always update coach_id
          })
          .eq('id', editingStudent.id);

        if (error) throw error;

        toast({
          title: "Sucesso!",
          description: "Aluno atualizado com sucesso",
        });
      } else {
        // Insert new student
        const { data: insertedData, error } = await supabase
          .from('alunos')
          .insert([{
            nome: newStudent.nome,
            email: newStudent.email,
            cpf_cnpj: newStudent.cpf_cnpj,
            telefone: newStudent.telefone || null,
            objetivo: newStudent.objetivo || null,
            plano: newStudent.plano || null,
            data_nascimento: newStudent.data_nascimento || null,
            peso: newStudent.peso ? parseInt(newStudent.peso) : null,
            coach_id: user.id, // Set coach_id for new students
          }])
          .select()
          .single();

        if (error) throw error;
        alunoId = insertedData?.id;

        toast({
          title: "Sucesso!",
          description: "Aluno adicionado com sucesso",
        });
      }

      // Se o aluno tem um plano associado, criar configuração de cobrança recorrente
      if (newStudent.plano && alunoId) {
        // Verificar se já existe configuração de cobrança para este aluno
        const { data: existingConfig } = await supabase
          .from('recurring_charges_config')
          .select('id')
          .eq('aluno_id', alunoId)
          .maybeSingle();

        if (!existingConfig) {
          // Criar configuração de cobrança recorrente
          const { error: configError } = await supabase
            .from('recurring_charges_config')
            .insert({
              aluno_id: alunoId,
              payment_plan_id: newStudent.plano,
              coach_id: user.id,
              ativo: true,
            });

          if (configError) {
            console.error('Erro ao criar configuração de cobrança:', configError);
            toast({
              title: "Atenção",
              description: "Aluno salvo, mas houve erro ao criar configuração de cobrança automática",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Cobrança configurada!",
              description: "Cobrança recorrente ativada para este aluno",
            });
          }
        } else if (editingStudent) {
          // Atualizar configuração existente se o plano mudou
          const { error: updateError } = await supabase
            .from('recurring_charges_config')
            .update({
              payment_plan_id: newStudent.plano,
            })
            .eq('aluno_id', alunoId);

          if (updateError) {
            console.error('Erro ao atualizar configuração de cobrança:', updateError);
          }
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
        peso: ""
      });
      
      setEditingStudent(null);
      setIsDialogOpen(false);
      carregarAlunos();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      toast({
        title: "Erro",
        description: editingStudent ? "Não foi possível atualizar o aluno" : "Não foi possível adicionar o aluno",
        variant: "destructive",
      });
    }
  };

  const handleEditStudent = (student: Student) => {
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
    
    setNewStudent({
      nome: student.name,
      email: student.email,
      telefone: student.phone || "",
      cpf_cnpj: student.cpf_cnpj || "",
      objetivo: student.goal || "",
      plano: planId,
      data_nascimento: student.data_nascimento || "",
      peso: student.peso?.toString() || ""
    });
    setIsDialogOpen(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Tem certeza que deseja deletar este aluno?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('alunos')
        .delete()
        .eq('id', studentId);

      if (error) throw error;

      toast({
        title: "Aluno deletado!",
        description: "O aluno foi removido com sucesso.",
      });

      carregarAlunos();
    } catch (error) {
      console.error('Erro ao deletar aluno:', error);
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o aluno.",
        variant: "destructive",
      });
    }
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

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || student.status === filterStatus;
    const matchesGoal = filterGoal === "all" || student.goal === filterGoal;
    
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
              peso: ""
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="premium" size="lg">
              <UserPlus className="w-5 h-5" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <Card key={student.id} className="bg-gradient-card border-0 shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={student.avatar} />
                    <AvatarFallback>{student.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
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
                <Badge className={getStatusColor(student.status)}>
                  {student.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
                <Badge className={getPlanColor(student.plan)}>
                  {student.plan}
                </Badge>
              </div>

              {/* Goal and Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Objetivo:</span>
                  <span className="font-medium">{student.goal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso:</span>
                  <span className="font-medium">{student.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-gradient-primary h-2 rounded-full transition-all"
                    style={{ width: `${student.progress}%` }}
                  />
                </div>
              </div>

              {/* Last Workout */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Último treino:</span>
                <span className="font-medium">{student.lastWorkout}</span>
              </div>

              {/* Payment Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pagamento:</span>
                <Badge className={getPaymentColor(student.payment)}>
                  {student.payment === 'paid' ? 'Em dia' : 
                   student.payment === 'overdue' ? 'Vencido' : 'Pendente'}
                </Badge>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {student.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`/alunos/${student.id}`)}
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
                  onClick={() => handleDeleteStudent(student.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredStudents.length === 0 && (
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