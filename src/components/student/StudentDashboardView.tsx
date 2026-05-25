import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getPlanoAlunoLegivel } from "@/lib/aluno-display";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";

function formatPeso(peso: unknown): string {
  if (peso == null || peso === "") return "—";
  const n = Number(peso);
  return Number.isFinite(n) ? `${n} kg` : String(peso);
}

function statusBadgeVariant(
  status: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" | "premium" {
  const s = (status || "").toLowerCase();
  if (s === "ativo" || s === "active") return "premium";
  if (s === "inativo" || s === "paused" || s === "pausado") return "secondary";
  if (s === "cancelado" || s === "cancelled") return "destructive";
  return "outline";
}

function formatStatusLabel(status: string | null | undefined): string {
  if (!status || !String(status).trim()) return "—";
  const s = String(status).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const StudentDashboardView = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [loading, setLoading] = useState(true);
  const [alunoData, setAlunoData] = useState<any>(null);
  const [treinoAtual, setTreinoAtual] = useState<any>(null);
  const [dietaAtual, setDietaAtual] = useState<any>(null);
  const [proximosEventos, setProximosEventos] = useState<any[]>([]);

  useEffect(() => {
    if (isReady && user) {
      loadDashboardData();
    } else if (isReady && !user) {
      setLoading(false);
    }
  }, [isReady, user]);

  const loadDashboardData = async () => {
    setLoading(true);
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      setAlunoData(null);
      setTreinoAtual(null);
      setDietaAtual(null);
      setProximosEventos([]);
      setLoading(false);
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
    const dietasAluno = dietas.filter((d) => d.aluno_id === aluno.id);
    const dieta =
      dietasAluno.find((d) => d.ativa === true) ||
      dietasAluno.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )[0] ||
      null;
    setDietaAtual(dieta);

    const eventosResult = await apiClient.requestSafe<any[]>('/api/agenda-eventos');
    const eventos = eventosResult.success && Array.isArray(eventosResult.data) ? eventosResult.data : [];
    const hoje = new Date().toISOString().split("T")[0];
    const proximos = eventos
      .filter(e => e.aluno_id === aluno.id && e.data_evento >= hoje)
      .sort((a, b) => new Date(a.data_evento || 0).getTime() - new Date(b.data_evento || 0).getTime())
      .slice(0, 3);
    setProximosEventos(proximos);
    setLoading(false);
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
            <CardTitle className="text-sm font-medium">Peso atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="mt-2 h-3 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatPeso(alunoData?.peso)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {alunoData?.objetivo
                    ? `Objetivo: ${alunoData.objetivo}`
                    : "Objetivo não informado"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Treino ativo</CardTitle>
            <Dumbbell className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-full max-w-[12rem]" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : treinoAtual?.nome ? (
              <>
                <div className="text-lg font-bold leading-tight line-clamp-2">
                  {treinoAtual.nome}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {treinoAtual.duracao != null
                    ? `Duração: ${treinoAtual.duracao} min`
                    : "Plano atribuído pelo coach"}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum treino atribuído
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dieta ativa</CardTitle>
            <Utensils className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-8 w-full max-w-[12rem]" />
                <Skeleton className="mt-2 h-3 w-28" />
              </>
            ) : dietaAtual?.nome ? (
              <>
                <div className="text-lg font-bold leading-tight line-clamp-2">
                  {dietaAtual.nome}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dietaAtual.data_retorno
                    ? `Retorno: ${new Date(dietaAtual.data_retorno).toLocaleDateString("pt-BR")}`
                    : "Plano nutricional do coach"}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma dieta atribuída
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="mt-2 h-3 w-36" />
              </>
            ) : (
              <>
                <Badge variant={statusBadgeVariant(alunoData?.status)} className="mt-1">
                  {formatStatusLabel(alunoData?.status)}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Plano: {getPlanoAlunoLegivel(alunoData, "—")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Treino Atual</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : treinoAtual ? (
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
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : proximosEventos.length > 0 ? (
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
