import { useState } from "react";
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

const StudentManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGoal, setFilterGoal] = useState("all");

  const students = [
    {
      id: 1,
      name: "Maria Silva",
      email: "maria@email.com",
      phone: "(11) 99999-9999",
      avatar: "/api/placeholder/60/60",
      status: "active",
      plan: "Premium",
      goal: "Emagrecimento",
      joinDate: "15 Jan 2024",
      lastWorkout: "Hoje",
      progress: 85,
      payment: "paid",
      tags: ["Iniciante", "Motivada"],
      nextPayment: "15 Fev 2024"
    },
    {
      id: 2,
      name: "João Santos",
      email: "joao@email.com",
      phone: "(11) 88888-8888",
      avatar: "/api/placeholder/60/60",
      status: "active",
      plan: "Básico",
      goal: "Hipertrofia",
      joinDate: "22 Jan 2024",
      lastWorkout: "Ontem",
      progress: 92,
      payment: "overdue",
      tags: ["Avançado", "Dedicado"],
      nextPayment: "20 Jan 2024"
    },
    {
      id: 3,
      name: "Ana Costa",
      email: "ana@email.com",
      phone: "(11) 77777-7777",
      avatar: "/api/placeholder/60/60",
      status: "inactive",
      plan: "Premium",
      goal: "Condicionamento",
      joinDate: "08 Dez 2023",
      lastWorkout: "3 dias atrás",
      progress: 45,
      payment: "paid",
      tags: ["Intermediária"],
      nextPayment: "08 Fev 2024"
    },
    {
      id: 4,
      name: "Pedro Lima",
      email: "pedro@email.com",
      phone: "(11) 66666-6666",
      avatar: "/api/placeholder/60/60",
      status: "active",
      plan: "VIP",
      goal: "Reabilitação",
      joinDate: "30 Nov 2023",
      lastWorkout: "Hoje",
      progress: 78,
      payment: "paid",
      tags: ["Lesão", "Cuidado"],
      nextPayment: "30 Jan 2024"
    }
  ];

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