import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Heart, 
  Moon, 
  Droplets,
  Sun,
  Brain,
  Apple
} from "lucide-react";

interface CheckinData {
  id: string;
  created_at: string;
  seguiu_plano_nota: number;
  treinou_todas_sessoes: boolean;
  fez_cardio: boolean;
  autoestima: number;
  media_horas_sono: string;
  ingeriu_agua_minima: boolean;
  estresse_semana: boolean;
  exposicao_sol: boolean;
  formato_fezes: string;
  media_evacuacoes: string;
  beliscou_fora_plano: string;
  apetite: string;
  lida_desafios: string;
  convivio_familiar: string;
  convivio_trabalho: string;
  nao_cumpriu_porque: string;
}

export default function StudentProgressDashboard() {
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>("30");

  useEffect(() => {
    loadCheckins();
  }, []);

  const loadCheckins = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!aluno) return;

      const { data, error } = await supabase
        .from("weekly_checkins")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCheckins(data || []);
    } catch (error) {
      console.error("Erro ao carregar check-ins:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCheckins = () => {
    if (periodFilter === "all") return checkins;
    
    const daysToFilter = parseInt(periodFilter);
    const cutoffDate = subDays(new Date(), daysToFilter);
    
    return checkins.filter(c => new Date(c.created_at) >= cutoffDate);
  };

  const filteredCheckins = getFilteredCheckins();

  if (loading) {
    return <div>Carregando dados...</div>;
  }

  if (checkins.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Nenhum check-in registrado ainda. Preencha seu primeiro check-in semanal!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (filteredCheckins.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Dashboard de Progresso</h2>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhum check-in encontrado neste período.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestCheckin = filteredCheckins[0];
  
  // Preparar dados para gráficos
  const chartData = [...filteredCheckins].reverse().map((c) => ({
    semana: format(new Date(c.created_at), "dd/MM", { locale: ptBR }),
    adesao: c.seguiu_plano_nota,
    autoestima: c.autoestima,
    treino: c.treinou_todas_sessoes ? 1 : 0,
    cardio: c.fez_cardio ? 1 : 0,
    agua: c.ingeriu_agua_minima ? 1 : 0,
    sol: c.exposicao_sol ? 1 : 0,
  }));

  const sonoMap: { [key: string]: number } = {
    "4-5": 4.5,
    "5-6": 5.5,
    "6-8": 7,
  };

  const horasSonoData = checkins.reverse().map((c) => ({
    semana: format(new Date(c.created_at), "dd/MM", { locale: ptBR }),
    horas: sonoMap[c.media_horas_sono] || 0,
  }));

  // Análise do último check-in
  const alerts = [];
  const positives = [];

  if (latestCheckin.beliscou_fora_plano === "prejudicando") {
    alerts.push("Beliscou fora do plano");
  } else {
    positives.push("100% comprometido com o plano");
  }

  if (latestCheckin.seguiu_plano_nota < 3) {
    alerts.push("Adesão ao plano baixa");
  } else if (latestCheckin.seguiu_plano_nota >= 4) {
    positives.push("Ótima adesão ao plano");
  }

  if (!latestCheckin.treinou_todas_sessoes) {
    alerts.push("Não completou todas as sessões de treino");
  } else {
    positives.push("Treinou todas as sessões");
  }

  if (!latestCheckin.fez_cardio) {
    alerts.push("Cardio não realizado");
  }

  if (!latestCheckin.ingeriu_agua_minima) {
    alerts.push("Hidratação insuficiente");
  } else {
    positives.push("Hidratação adequada");
  }

  if (latestCheckin.autoestima < 3) {
    alerts.push("Autoestima baixa");
  }

  if (latestCheckin.media_horas_sono === "4-5") {
    alerts.push("Sono insuficiente");
  } else if (latestCheckin.media_horas_sono === "6-8") {
    positives.push("Sono adequado");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Progresso</h2>
          <p className="text-muted-foreground mt-2">
            {filteredCheckins.length} check-in{filteredCheckins.length !== 1 ? 's' : ''} no período selecionado
          </p>
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumo do último check-in */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Pontos Positivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positives.length > 0 ? (
              <div className="space-y-2">
                {positives.map((item, i) => (
                  <Badge key={i} variant="outline" className="mr-2 bg-green-500/10 text-green-700 border-green-200">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ponto positivo destacado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Pontos de Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.map((item, i) => (
                  <Badge key={i} variant="outline" className="mr-2 bg-red-500/10 text-red-700 border-red-200">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tudo dentro do esperado! 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adesão ao Plano</CardTitle>
            <Apple className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestCheckin.seguiu_plano_nota}/5</div>
            <p className="text-xs text-muted-foreground">Última semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Autoestima</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestCheckin.autoestima}/5</div>
            <p className="text-xs text-muted-foreground">Última semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Treinos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestCheckin.treinou_todas_sessoes ? "✓" : "✗"}
            </div>
            <p className="text-xs text-muted-foreground">
              {latestCheckin.treinou_todas_sessoes ? "Completos" : "Incompletos"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sono</CardTitle>
            <Moon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestCheckin.media_horas_sono.replace("-", "-")}h
            </div>
            <p className="text-xs text-muted-foreground">Média diária</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução - Adesão e Autoestima</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="adesao" 
                stroke="hsl(var(--primary))" 
                name="Adesão ao Plano"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="autoestima" 
                stroke="hsl(var(--chart-2))" 
                name="Autoestima"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de hábitos */}
      <Card>
        <CardHeader>
          <CardTitle>Hábitos Semanais</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="treino" fill="hsl(var(--chart-1))" name="Treino Completo" />
              <Bar dataKey="cardio" fill="hsl(var(--chart-2))" name="Cardio" />
              <Bar dataKey="agua" fill="hsl(var(--chart-3))" name="Água" />
              <Bar dataKey="sol" fill="hsl(var(--chart-4))" name="Sol" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de sono */}
      <Card>
        <CardHeader>
          <CardTitle>Qualidade do Sono</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={horasSonoData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis domain={[4, 8]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="horas" 
                stroke="hsl(var(--chart-5))" 
                name="Horas de Sono"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Observações do último check-in */}
      {latestCheckin.nao_cumpriu_porque && (
        <Card>
          <CardHeader>
            <CardTitle>Última Observação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {format(new Date(latestCheckin.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <p className="mt-2">{latestCheckin.nao_cumpriu_porque}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
