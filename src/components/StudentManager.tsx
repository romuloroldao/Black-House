import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Users
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGoal, setFilterGoal] = useState("all");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAlunos();
  }, []);

  const carregarAlunos = async () => {
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const alunosFormatados: Student[] = data?.map(aluno => ({
        id: aluno.id,
        name: aluno.nome || 'Sem nome',
        email: aluno.email,
        phone: '(11) 99999-9999', // Placeholder - adicionar campo no banco se necessário
        avatar: '/api/placeholder/60/60',
        status: 'active', // Placeholder - adicionar campo no banco se necessário
        plan: 'Básico', // Placeholder - adicionar campo no banco se necessário
        goal: aluno.objetivo || 'Sem objetivo definido',
        joinDate: new Date(aluno.created_at).toLocaleDateString('pt-BR'),
        lastWorkout: 'Não registrado', // Placeholder - implementar quando houver treinos
        progress: 0, // Placeholder - calcular baseado em treinos/dietas
        payment: 'paid', // Placeholder - adicionar campo no banco se necessário
        tags: [], // Placeholder - adicionar campo no banco se necessário
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-white';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentColor = (payment: string) => {
    switch (payment) {
      case 'paid': return 'bg-success text-white';
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'VIP': return 'bg-primary text-primary-foreground';
      case 'Premium': return 'bg-primary/80 text-primary-foreground';
      case 'Básico': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="premium" size="lg">
              <UserPlus className="w-5 h-5" />
              Novo Aluno
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Aluno</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <Input placeholder="Nome completo" />
              <Input placeholder="Email" type="email" />
              <Input placeholder="Telefone" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                  <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                  <SelectItem value="condicionamento">Condicionamento</SelectItem>
                  <SelectItem value="reabilitacao">Reabilitação</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Data de nascimento" type="date" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button variant="premium">Salvar Aluno</Button>
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
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-4 h-4" />
                  Editar
                </Button>
                <Button variant="premium" size="sm" className="flex-1">
                  <Target className="w-4 h-4" />
                  Treino
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