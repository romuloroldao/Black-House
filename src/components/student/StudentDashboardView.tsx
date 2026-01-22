import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";

const StudentDashboardView = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [alunoData, setAlunoData] = useState<any>(null);
  const [treinoAtual, setTreinoAtual] = useState<any>(null);
  const [dietaAtual, setDietaAtual] = useState<any>(null);
  const [proximosEventos, setProximosEventos] = useState<any[]>([]);

  // DESIGN-022: Componente só renderiza quando DataContext === READY
  if (!isReady) {
    return null;
  }

  // DESIGN-022: useEffect removido - loadDashboardData() não deve ser chamado em mount
  // Dados devem ser carregados sob demanda ou via props/contexto

  const loadDashboardData = async () => {
    try {
      // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();

      if (aluno) {
        setAlunoData(aluno);

        // Carregar treino atual
        const alunosTreinos = await apiClient
          .from("alunos_treinos")
          .select("*")
          .eq("aluno_id", aluno.id)
          .eq("ativo", true);
        
        const alunoTreino = Array.isArray(alunosTreinos) && alunosTreinos.length > 0 ? alunosTreinos[0] : null;

        if (alunoTreino) {
          // Buscar treino separadamente
          const treinos = await apiClient
            .from("treinos")
            .select("*")
            .eq("id", alunoTreino.treino_id);
          const treino = Array.isArray(treinos) && treinos.length > 0 ? treinos[0] : null;
          setTreinoAtual(treino);
        }

        // Carregar dieta atual
        const dietas = await apiClient
          .from("dietas")
          .select("*")
          .eq("aluno_id", aluno.id)
          .order("created_at", { ascending: false })
          .limit(1);
        
        const dieta = Array.isArray(dietas) && dietas.length > 0 ? dietas[0] : null;
        setDietaAtual(dieta);

        // Carregar próximos eventos
        const hoje = new Date().toISOString().split("T")[0];
        const eventos = await apiClient
          .from("agenda_eventos")
          .select("*")
          .eq("aluno_id", aluno.id)
          .gte("data_evento", hoje)
          .order("data_evento", { ascending: true })
          .limit(3);

        setProximosEventos(Array.isArray(eventos) ? eventos : []);
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bem-vindo de volta!</h1>
        <p className="text-muted-foreground">
          Continue sua jornada de transformação
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Peso Atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunoData?.peso || "--"} kg</div>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: Ganho de massa
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Treinos/Semana</CardTitle>
            <Dumbbell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <Progress value={71} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dieta Seguida</CardTitle>
            <Utensils className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <Progress value={85} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Badge variant="premium" className="mt-1">Ativo</Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Plano: {alunoData?.plano || "Premium"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Treino Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {treinoAtual ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{treinoAtual.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {treinoAtual.descricao}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{treinoAtual.categoria}</Badge>
                  <Badge variant="outline">{treinoAtual.dificuldade}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Duração: {treinoAtual.duracao} min
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum treino atribuído</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Próximos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            {proximosEventos.length > 0 ? (
              <div className="space-y-3">
                {proximosEventos.map((evento) => (
                  <div key={evento.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">{evento.titulo}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(evento.data_evento).toLocaleDateString("pt-BR")}
                        {evento.hora_evento && ` às ${evento.hora_evento}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum evento agendado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboardView;
