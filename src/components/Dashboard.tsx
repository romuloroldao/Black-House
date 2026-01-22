import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SearchDialog from "./SearchDialog";
import { 
  Users, 
  Dumbbell, 
  MessageSquare, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Plus,
  MoreVertical,
  Award,
  Target,
  Video
} from "lucide-react";

interface DashboardProps {
  onTabChange?: (tab: string) => void;
}

const Dashboard = ({ onTabChange }: DashboardProps) => {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [stats, setStats] = useState({
    totalAlunos: 0,
    totalDietas: 0,
    totalTreinos: 0,
    totalVideos: 0,
    mensagensNaoLidas: 0,
  });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, [user]);

  const carregarEstatisticas = async () => {
    if (!user) return;
    
    try {
      // BLACKHOUSE-BACKEND-SOVEREIGN-ARCH-004: Usar endpoint REST canônico
      // Carregar total de alunos
      const alunos = await apiClient.getAlunosByCoach();
      const countAlunos = Array.isArray(alunos) ? alunos.length : 0;

      // DESIGN-SUPABASE-PURGE-MESSAGING-001: Remover PostgREST. Substituir por endpoints semânticos futuros.
      // Temporariamente, definir como 0 ou buscar de forma simplificada se houver endpoint.
      const countDietas = 0; // await apiClient.getDietasCount(); // Exemplo de futura rota semântica
      const countTreinos = 0; // await apiClient.getTreinosCountByCoach(user.id);
      const countVideos = 0; // await apiClient.getVideosCountByCoach(user.id);

      // DESIGN-SUPABASE-PURGE-MESSAGING-001: Coach não deve usar rotas de mensagens
      // Mensagens são exclusivas para alunos
      // Para coach, usar endpoint específico quando disponível
      let totalMensagensNaoLidas = 0;
      // TODO: Criar endpoint GET /api/mensagens/coach para coaches quando necessário
      // Por enquanto, coaches não têm acesso a mensagens via API

      // BLACKHOUSE-BACKEND-SOVEREIGN-ARCH-004: Usar endpoint REST canônico
      // Carregar alunos recentes (ordenado por created_at DESC, limitado a 5)
      const todosAlunos = await apiClient.getAlunosByCoach();
      const alunosRecentes = Array.isArray(todosAlunos) 
        ? todosAlunos
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
            .map(a => ({ id: a.id, nome: a.nome, email: a.email, created_at: a.created_at }))
        : [];

      setStats({
        totalAlunos: countAlunos,
        totalDietas: countDietas,
        totalTreinos: countTreinos,
        totalVideos: countVideos,
        mensagensNaoLidas: totalMensagensNaoLidas,
      });

      setRecentStudents(Array.isArray(alunosRecentes) ? alunosRecentes : []);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: "Alunos Ativos",
      value: loading ? "..." : stats.totalAlunos.toString(),
      change: stats.totalAlunos > 0 ? "+12%" : "0%",
      icon: Users,
      color: "text-primary",
      onClick: () => onTabChange?.('students'),
    },
    {
      title: "Treinos Criados",
      value: loading ? "..." : stats.totalTreinos.toString(),
      change: stats.totalTreinos > 0 ? "+8%" : "0%",
      icon: Dumbbell,
      color: "text-primary",
      onClick: () => onTabChange?.('workouts'),
    },
    {
      title: "Mensagens Pendentes",
      value: loading ? "..." : stats.mensagensNaoLidas.toString(),
      change: stats.mensagensNaoLidas > 0 ? `${stats.mensagensNaoLidas}` : "0",
      icon: MessageSquare,
      color: "text-warning",
      onClick: () => onTabChange?.('messages'),
    },
    {
      title: "Vídeos Disponíveis",
      value: loading ? "..." : stats.totalVideos.toString(),
      change: stats.totalVideos > 0 ? "+5%" : "0%",
      icon: Video,
      color: "text-primary",
      onClick: () => onTabChange?.('videos'),
    },
  ];

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return `há ${diffInMinutes} min`;
    } else if (diffInHours < 24) {
      return `há ${diffInHours}h`;
    } else {
      return `há ${diffInDays} dias`;
    }
  };

  const recentActivities = recentStudents.map((student, index) => ({
    id: student.id,
    student: student.nome,
    action: "foi adicionado(a) ao sistema",
    time: formatTimeAgo(new Date(student.created_at)),
    avatar: "",
    type: "student"
  }));

  const upcomingTasks = [
    {
      id: 1,
      title: `${stats.totalAlunos} alunos cadastrados`,
      time: "Gerenciar",
      type: "assessment",
      onClick: () => onTabChange?.('students'),
    },
    {
      id: 2,
      title: `${stats.mensagensNaoLidas} mensagens não lidas`,
      time: "Responder",
      type: "message",
      onClick: () => onTabChange?.('messages'),
    },
    {
      id: 3,
      title: `${stats.totalVideos} vídeos disponíveis`,
      time: "Ver galeria",
      type: "live",
      onClick: () => onTabChange?.('videos'),
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'workout': return <Dumbbell className="w-4 h-4 text-primary" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-warning" />;
      case 'checkin': return <Target className="w-4 h-4 text-primary" />;
      case 'achievement': return <Award className="w-4 h-4 text-primary" />;
      case 'student': return <Users className="w-4 h-4 text-primary" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'assessment': return <Users className="w-4 h-4 text-primary" />;
      case 'payment': return <DollarSign className="w-4 h-4 text-destructive" />;
      case 'live': return <Video className="w-4 h-4 text-primary" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-warning" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Bem-vindo de volta! 👋</h2>
          <p className="text-muted-foreground">
            Aqui está um resumo das suas atividades de hoje
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <Card 
              key={index} 
              className="bg-gradient-card border-0 shadow-card hover:shadow-elevated transition-smooth cursor-pointer"
              onClick={stat.onClick}
            >
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
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-smooth">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={activity.avatar} />
                        <AvatarFallback>{activity.student.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
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
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
                  </div>
                )}
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
                <Button 
                  variant="premium" 
                  className="w-full justify-start" 
                  size="lg"
                  onClick={() => onTabChange?.('workouts')}
                >
                  <Plus className="w-4 h-4" />
                  Novo Treino
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => onTabChange?.('students')}
                >
                  <Users className="w-4 h-4" />
                  Adicionar Aluno
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => onTabChange?.('messages')}
                >
                  <MessageSquare className="w-4 h-4" />
                  Ver Mensagens
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => onTabChange?.('videos')}
                >
                  <Video className="w-4 h-4" />
                  Galeria de Vídeos
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
                  <div 
                    key={task.id} 
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-smooth cursor-pointer"
                    onClick={task.onClick}
                  >
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
                    <span>Alunos Ativos</span>
                    <span>{stats.totalAlunos}</span>
                  </div>
                  <Progress value={Math.min((stats.totalAlunos / 50) * 100, 100)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Treinos Criados</span>
                    <span>{stats.totalTreinos}</span>
                  </div>
                  <Progress value={Math.min((stats.totalTreinos / 30) * 100, 100)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Vídeos</span>
                    <span>{stats.totalVideos}</span>
                  </div>
                  <Progress value={Math.min((stats.totalVideos / 20) * 100, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Dialog */}
      <SearchDialog 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
        onNavigate={onTabChange}
      />
    </div>
  );
};

export default Dashboard;