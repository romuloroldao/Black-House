import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Dumbbell, 
  MessageSquare, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Plus,
  Bell,
  Search,
  Filter,
  MoreVertical,
  Play,
  Heart,
  Award,
  Target
} from "lucide-react";

const Dashboard = () => {
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [totalDietas, setTotalDietas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      // Carregar total de alunos
      const { count: countAlunos, error: errorAlunos } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true });

      if (errorAlunos) throw errorAlunos;
      setTotalAlunos(countAlunos || 0);

      // Carregar total de dietas
      const { count: countDietas, error: errorDietas } = await supabase
        .from('dietas')
        .select('*', { count: 'exact', head: true });

      if (errorDietas) throw errorDietas;
      setTotalDietas(countDietas || 0);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Alunos Ativos",
      value: loading ? "..." : totalAlunos.toString(),
      change: "+12%",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Dietas Criadas",
      value: loading ? "..." : totalDietas.toString(),
      change: "+8%",
      icon: Dumbbell,
      color: "text-success",
    },
    {
      title: "Mensagens Pendentes",
      value: "8",
      change: "-3",
      icon: MessageSquare,
      color: "text-warning",
    },
    {
      title: "Faturamento Mensal",
      value: "R$ 18.500",
      change: "+23%",
      icon: DollarSign,
      color: "text-primary",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      student: "Maria Silva",
      action: "completou o treino",
      time: "há 15 min",
      avatar: "/api/placeholder/40/40",
      type: "workout"
    },
    {
      id: 2,
      student: "João Santos",
      action: "enviou uma dúvida",
      time: "há 32 min",
      avatar: "/api/placeholder/40/40",
      type: "message"
    },
    {
      id: 3,
      student: "Ana Costa",
      action: "fez check-in semanal",
      time: "há 1h",
      avatar: "/api/placeholder/40/40",
      type: "checkin"
    },
    {
      id: 4,
      student: "Pedro Lima",
      action: "atingiu meta de 30 dias",
      time: "há 2h",
      avatar: "/api/placeholder/40/40",
      type: "achievement"
    },
  ];

  const upcomingTasks = [
    {
      id: 1,
      title: "Reavaliação - Maria Silva",
      time: "14:00",
      type: "assessment"
    },
    {
      id: 2,
      title: "Pagamento vencido - João Santos",
      time: "Venceu ontem",
      type: "payment"
    },
    {
      id: 3,
      title: "Live de Nutrição",
      time: "19:00",
      type: "live"
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'workout': return <Dumbbell className="w-4 h-4 text-primary" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-warning" />;
      case 'checkin': return <Target className="w-4 h-4 text-success" />;
      case 'achievement': return <Award className="w-4 h-4 text-primary" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'assessment': return <Calendar className="w-4 h-4 text-primary" />;
      case 'payment': return <DollarSign className="w-4 h-4 text-destructive" />;
      case 'live': return <Play className="w-4 h-4 text-success" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                FitCoach Pro
              </h1>
              <p className="text-muted-foreground">Dashboard do Personal Trainer</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-xs flex items-center justify-center text-destructive-foreground">
                  3
                </span>
              </Button>
              <Avatar>
                <AvatarImage src="/api/placeholder/40/40" />
                <AvatarFallback>PT</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Bem-vindo de volta! 👋</h2>
          <p className="text-muted-foreground">
            Aqui está um resumo das suas atividades de hoje
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-gradient-card border-0 shadow-card hover:shadow-elevated transition-smooth">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{stat.value}</span>
                      <Badge variant="outline" className={`${stat.color} border-current`}>
                        {stat.change}
                      </Badge>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg bg-primary/10 ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activities */}
          <div className="lg:col-span-2">
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Atividades Recentes
                </CardTitle>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-smooth">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={activity.avatar} />
                      <AvatarFallback>{activity.student.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.student}</span>{' '}
                        <span className="text-muted-foreground">{activity.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="premium" className="w-full justify-start" size="lg">
                  <Plus className="w-4 h-4" />
                  Novo Treino
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4" />
                  Adicionar Aluno
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4" />
                  Enviar Mensagem
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Play className="w-4 h-4" />
                  Iniciar Live
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Próximas Tarefas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-smooth">
                    {getTaskIcon(task.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Progress Overview */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Progresso Mensal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Meta de Treinos</span>
                    <span>156/200</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Novos Alunos</span>
                    <span>12/15</span>
                  </div>
                  <Progress value={80} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Retenção</span>
                    <span>94%</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;