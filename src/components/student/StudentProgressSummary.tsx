import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Apple,
  Dumbbell,
  Moon,
  Heart,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Checkin = {
  id: string;
  created_at: string;
  seguiu_plano_nota: number;
  treinou_todas_sessoes: boolean;
  autoestima: number;
  media_horas_sono: string;
  ingeriu_agua_minima: boolean;
};

type Props = {
  onGoCheckin?: () => void;
  onShowDetails?: () => void;
};

function sonoHours(v: string): number {
  const map: Record<string, number> = { "4-5": 4.5, "5-6": 5.5, "6-8": 7 };
  return map[v] ?? 0;
}

function Trend({ delta }: { delta: number | null }) {
  if (delta == null || Number.isNaN(delta)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> sem base
      </span>
    );
  }
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        up ? "text-emerald-600" : "text-destructive"
      }`}
    >
      {up ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {up ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

export default function StudentProgressSummary({
  onGoCheckin,
  onShowDetails,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinDue, setCheckinDue] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      if (!aluno) return;

      const { data } = await supabase
        .from("weekly_checkins")
        .select(
          "id, created_at, seguiu_plano_nota, treinou_todas_sessoes, autoestima, media_horas_sono, ingeriu_agua_minima"
        )
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false })
        .limit(12);

      const list = (data || []) as Checkin[];
      setCheckins(list);

      const start = new Date();
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - diff);
      const thisWeek = list.some((c) => new Date(c.created_at) >= start);
      setCheckinDue(!thisWeek);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const latest = checkins[0];
  const previous = checkins[1];

  const score = useMemo(() => {
    if (!latest) return null;
    // Score 0–100 a partir de 4 sinais do último check-in
    const adesao = (latest.seguiu_plano_nota / 5) * 25;
    const treino = latest.treinou_todas_sessoes ? 25 : 0;
    const sono = Math.min(sonoHours(latest.media_horas_sono) / 7, 1) * 25;
    const auto = (latest.autoestima / 5) * 25;
    return Math.round(adesao + treino + sono + auto);
  }, [latest]);

  const prevScore = useMemo(() => {
    if (!previous) return null;
    const adesao = (previous.seguiu_plano_nota / 5) * 25;
    const treino = previous.treinou_todas_sessoes ? 25 : 0;
    const sono = Math.min(sonoHours(previous.media_horas_sono) / 7, 1) * 25;
    const auto = (previous.autoestima / 5) * 25;
    return Math.round(adesao + treino + sono + auto);
  }, [previous]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">
            Ainda não há check-ins. Seu progresso aparece aqui depois do
            primeiro envio.
          </p>
          {onGoCheckin && (
            <Button className="min-h-[44px]" onClick={onGoCheckin}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Fazer check-in
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      key: "adesao",
      label: "Adesão ao plano",
      icon: Apple,
      value: `${latest.seguiu_plano_nota}/5`,
      delta:
        previous != null
          ? latest.seguiu_plano_nota - previous.seguiu_plano_nota
          : null,
    },
    {
      key: "treino",
      label: "Treino completo",
      icon: Dumbbell,
      value: latest.treinou_todas_sessoes ? "Sim" : "Não",
      delta: null as number | null,
    },
    {
      key: "sono",
      label: "Sono",
      icon: Moon,
      value: `${latest.media_horas_sono || "—"} h`,
      delta:
        previous != null
          ? sonoHours(latest.media_horas_sono) -
            sonoHours(previous.media_horas_sono)
          : null,
    },
    {
      key: "autoestima",
      label: "Autoestima",
      icon: Heart,
      value: `${latest.autoestima}/5`,
      delta:
        previous != null ? latest.autoestima - previous.autoestima : null,
    },
  ];

  const scoreDelta =
    score != null && prevScore != null ? score - prevScore : null;

  return (
    <div className="space-y-4">
      {checkinDue && onGoCheckin && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <p className="font-medium">Check-in da semana pendente</p>
              <p className="text-sm text-muted-foreground">
                Atualize suas métricas para manter o progresso em dia.
              </p>
            </div>
            <Button className="min-h-[44px] shrink-0" onClick={onGoCheckin}>
              Fazer agora
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Score da última semana
              </p>
              <CardTitle className="text-4xl tabular-nums mt-1">
                {score}
                <span className="text-lg font-normal text-muted-foreground">
                  /100
                </span>
              </CardTitle>
            </div>
            <Trend delta={scoreDelta} />
          </div>
          <p className="text-sm text-muted-foreground">
            Check-in de{" "}
            {format(new Date(latest.created_at), "dd 'de' MMMM", {
              locale: ptBR,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <Progress value={score ?? 0} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Calculado com adesão, treino, sono e autoestima do último check-in
            — sem números inventados.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.key}>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{m.label}</span>
                </div>
                <p className="text-xl font-semibold">{m.value}</p>
                <Trend delta={m.delta} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {latest.ingeriu_agua_minima != null && (
        <div className="flex flex-wrap gap-2">
          <Badge variant={latest.ingeriu_agua_minima ? "secondary" : "outline"}>
            Água: {latest.ingeriu_agua_minima ? "meta ok" : "abaixo da meta"}
          </Badge>
          {checkins.length > 1 && (
            <Badge variant="outline">
              {checkins.length} check-ins no histórico
            </Badge>
          )}
        </div>
      )}

      {onShowDetails && (
        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={onShowDetails}
        >
          Ver detalhes e gráficos
        </Button>
      )}
    </div>
  );
}
