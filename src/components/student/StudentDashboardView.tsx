import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getPlanoAlunoLegivel } from "@/lib/aluno-display";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";

const StudentDashboardView = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [alunoData, setAlunoData] = useState<any>(null);
  const [treinoAtual, setTreinoAtual] = useState<any>(null);
  const [dietaAtual, setDietaAtual] = useState<any>(null);
  const [proximosEventos, setProximosEventos] = useState<any[]>([]);

  useEffect(() => {
    if (isReady && user) {
      loadDashboardData();
    }
  }, [isReady, user]);

  const loadDashboardData = async () => {
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      setAlunoData(null);
      setTreinoAtual(null);
      setDietaAtual(null);
      setProximosEventos([]);
      return;
    }

    setAlunoData(aluno);

    const alunosTreinosResult = await apiClient.requestSafe<any[]>('/api/alunos-treinos');
    const alunosTreinos = alunosTreinosResult.success && Array.isArray(alunosTreinosResult.data) ? alunosTreinosResult.data : [];
    const alunoTreino = alunosTreinos.find(at => at.aluno_id === aluno.id && at.ativo === true) || null;

    if (alunoTreino?.treino_id) {
      const treinoResult = await apiClient.requestSafe<any>(`/api/treinos/${alunoTreino.treino_id}`);
      setTreinoAtual(treinoResult.success ? treinoResult.data : null);
    } else {
      setTreinoAtual(null);
    }

    const dietasResult = await apiClient.requestSafe<any[]>('/api/dietas');
    const dietas = dietasResult.success && Array.isArray(dietasResult.data) ? dietasResult.data : [];
    const dieta = dietas
      .filter(d => d.aluno_id === aluno.id)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
    setDietaAtual(dieta);

    const eventosResult = await apiClient.requestSafe<any[]>('/api/agenda-eventos');
    const eventos = eventosResult.success && Array.isArray(eventosResult.data) ? eventosResult.data : [];
    const hoje = new Date().toISOString().split("T")[0];
    const proximos = eventos
      .filter(e => e.aluno_id === aluno.id && e.data_evento >= hoje)
      .sort((a, b) => new Date(a.data_evento || 0).getTime() - new Date(b.data_evento || 0).getTime())
      .slice(0, 3);
    setProximosEventos(proximos);
  };

  // DESIGN-022: durante bootstrap mostra esqueleto (evita tela em branco no mobile)
  if (!isReady) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-[75%]" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader>
              <Skeleton className="h-6 w-44" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl mb-2">Bem-vindo de volta!</h1>
        <p className="text-muted-foreground">
          Continue sua jornada de transformação
        </p>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              Plano: {getPlanoAlunoLegivel(alunoData)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 md:grid-cols-2">
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
