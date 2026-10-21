import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Dumbbell,
  Utensils,
  ClipboardCheck,
  ChevronRight,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { trackStudentEvent } from "@/lib/studentAnalytics";

interface StudentDashboardViewProps {
  onNavigate?: (tab: string) => void;
}

function getStartOfWeekISO() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString();
}

const StudentDashboardView = ({ onNavigate }: StudentDashboardViewProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [peso, setPeso] = useState<number | null>(null);
  const [plano, setPlano] = useState<string | null>(null);
  const [treinoAtual, setTreinoAtual] = useState<any>(null);
  const [dietaAtual, setDietaAtual] = useState<any>(null);
  const [proximosEventos, setProximosEventos] = useState<any[]>([]);
  const [checkinPendente, setCheckinPendente] = useState(false);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: aluno, error: alunoError } = await supabase
        .from("alunos")
        .select("*")
        .eq("email", user?.email)
        .maybeSingle();

      if (alunoError) {
        console.error("Erro ao carregar aluno:", alunoError);
        return;
      }

      if (!aluno) return;

      setFirstName((aluno.nome || user?.email || "Aluno").split(" ")[0]);
      setPeso(aluno.peso ?? null);
      setPlano(aluno.plano ?? null);

      const [{ data: alunoTreino }, { data: dieta }, { data: eventos }, { data: checkins }] =
        await Promise.all([
          supabase
            .from("alunos_treinos")
            .select("*, treinos(*)")
            .eq("aluno_id", aluno.id)
            .eq("ativo", true)
            .order("data_inicio", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("dietas")
            .select("*")
            .eq("aluno_id", aluno.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("agenda_eventos")
            .select("*")
            .eq("aluno_id", aluno.id)
            .gte("data_evento", new Date().toISOString().split("T")[0])
            .order("data_evento", { ascending: true })
            .limit(3),
          supabase
            .from("weekly_checkins")
            .select("id")
            .eq("aluno_id", aluno.id)
            .gte("created_at", getStartOfWeekISO())
            .limit(1),
        ]);

      setTreinoAtual(alunoTreino?.treinos ?? null);
      setDietaAtual(dieta);
      setProximosEventos(eventos || []);
      setCheckinPendente(!(checkins && checkins.length > 0));
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const go = (tab: string, cta: string) => {
    trackStudentEvent("hoje_cta_clicked", { cta, tab });
    onNavigate?.(tab);
  };

  type PrimaryCta = {
    tab: string;
    cta: string;
    title: string;
    description: string;
    icon: typeof ClipboardCheck;
  };

  const primaryCta: PrimaryCta | null = checkinPendente
    ? {
        tab: "checkin",
        cta: "checkin",
        title: "Fazer check-in da semana",
        description: "Leva poucos minutos e ajuda seu coach a ajustar o plano.",
        icon: ClipboardCheck,
      }
    : treinoAtual
      ? {
          tab: "workouts",
          cta: "treino",
          title: `Treino: ${treinoAtual.nome}`,
          description: treinoAtual.duracao
            ? `Plano ativo · cerca de ${treinoAtual.duracao} min`
            : "Seu plano de treino ativo",
          icon: Dumbbell,
        }
      : dietaAtual
        ? {
            tab: "diet",
            cta: "dieta",
            title: "Ver cardápio de hoje",
            description: dietaAtual.nome || "Sua dieta personalizada",
            icon: Utensils,
          }
        : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const PrimaryIcon = primaryCta?.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">
          Olá, {firstName}
        </h1>
        <p className="text-muted-foreground">
          Sua tarefa de hoje, sem distração.
        </p>
      </div>

      {primaryCta && PrimaryIcon ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <PrimaryIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                    Ação principal
                  </p>
                  <h2 className="text-xl font-semibold leading-tight">
                    {primaryCta.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {primaryCta.description}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto min-h-[44px]"
                  onClick={() => go(primaryCta.tab, primaryCta.cta)}
                >
                  Começar
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <p className="font-medium">Nenhuma tarefa pendente no momento</p>
            <p className="text-sm text-muted-foreground">
              Quando seu coach atribuir treino ou dieta, eles aparecem aqui.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {treinoAtual && primaryCta?.cta !== "treino" && (
          <button
            type="button"
            onClick={() => go("workouts", "treino_secondary")}
            className="text-left rounded-lg border bg-card p-4 min-h-[44px] hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Dumbbell className="h-4 w-4 text-primary" />
              Treino ativo
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {treinoAtual.nome}
            </p>
          </button>
        )}

        {dietaAtual && primaryCta?.cta !== "dieta" && (
          <button
            type="button"
            onClick={() => go("diet", "dieta_secondary")}
            className="text-left rounded-lg border bg-card p-4 min-h-[44px] hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Utensils className="h-4 w-4 text-primary" />
              Dieta
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {dietaAtual.nome || "Plano alimentar"}
            </p>
          </button>
        )}

        {!checkinPendente && (
          <button
            type="button"
            onClick={() => go("progress", "progresso_secondary")}
            className="text-left rounded-lg border bg-card p-4 min-h-[44px] hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Check-in
            </div>
            <p className="text-sm text-muted-foreground">
              Já enviado esta semana · ver progresso
            </p>
          </button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Peso</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {peso != null ? `${peso} kg` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {peso != null
                ? "Registrado no seu perfil"
                : "Ainda não informado"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Plano</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {plano ? (
              <>
                <Badge variant="premium" className="mt-1">
                  Ativo
                </Badge>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {plano}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem plano vinculado</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {proximosEventos.length > 0 ? (
            <div className="space-y-3">
              {proximosEventos.map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{evento.titulo}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(evento.data_evento).toLocaleDateString("pt-BR")}
                      {evento.hora_evento && ` às ${evento.hora_evento}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum evento agendado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboardView;
