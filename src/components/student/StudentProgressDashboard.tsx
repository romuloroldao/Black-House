import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
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

interface StudentProgressDashboardProps {
  studentId?: string; // ID do aluno (usado quando o professor está visualizando)
}

export default function StudentProgressDashboard({ studentId }: StudentProgressDashboardProps = {}) {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>("30");

  useEffect(() => {
    loadCheckins();
  }, [studentId]);

  const loadCheckins = async () => {
    try {
      let alunoId = studentId;

      // Se não foi passado studentId, buscar pelo usuário logado (modo aluno)
      if (!alunoId) {
        if (!user) return;

        // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
        const aluno = await apiClient.getMe();
        if (!aluno) return;
        alunoId = aluno.id;
      }

      const data = await apiClient
        .from("weekly_checkins")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
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

  const getPreviousPeriodCheckins = () => {
    if (periodFilter === "all") return [];
    
    const daysToFilter = parseInt(periodFilter);
    const currentPeriodStart = subDays(new Date(), daysToFilter);
    const previousPeriodStart = subDays(currentPeriodStart, daysToFilter);
    
    return checkins.filter(c => {
      const date = new Date(c.created_at);
      return date >= previousPeriodStart && date < currentPeriodStart;
    });
  };

  const calculateAverage = (checkinsData: CheckinData[], metric: string): number => {
    if (checkinsData.length === 0) return 0;
    
    const sum = checkinsData.reduce((acc, c) => {
      if (metric === 'adesao') return acc + c.seguiu_plano_nota;
      if (metric === 'autoestima') return acc + c.autoestima;
      if (metric === 'treino') return acc + (c.treinou_todas_sessoes ? 1 : 0);
      if (metric === 'cardio') return acc + (c.fez_cardio ? 1 : 0);
      if (metric === 'agua') return acc + (c.ingeriu_agua_minima ? 1 : 0);
      if (metric === 'sono') {
        const sonoMap: { [key: string]: number } = { "4-5": 4.5, "5-6": 5.5, "6-8": 7 };
        return acc + (sonoMap[c.media_horas_sono] || 0);
      }
      return acc;
    }, 0);
    
    return sum / checkinsData.length;
  };

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const filteredCheckins = getFilteredCheckins();
  const previousPeriodCheckins = getPreviousPeriodCheckins();

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

      {/* Comparação entre Períodos */}
      {periodFilter !== "all" && previousPeriodCheckins.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Comparação de Períodos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Período atual vs período anterior (mesmo intervalo de tempo)
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Adesão ao Plano */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'adesao');
                const previousAvg = calculateAverage(previousPeriodCheckins, 'adesao');
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Apple className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Adesão ao Plano</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">de 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(1)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Autoestima */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'autoestima');
                const previousAvg = calculateAverage(previousPeriodCheckins, 'autoestima');
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Autoestima</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">de 5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(1)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Frequência de Treino */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'treino') * 100;
                const previousAvg = calculateAverage(previousPeriodCheckins, 'treino') * 100;
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Treino Completo</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(0)}%</span>
                        <span className="text-sm text-muted-foreground">das semanas</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Hidratação */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'agua') * 100;
                const previousAvg = calculateAverage(previousPeriodCheckins, 'agua') * 100;
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Hidratação</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(0)}%</span>
                        <span className="text-sm text-muted-foreground">adequada</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Qualidade do Sono */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'sono');
                const previousAvg = calculateAverage(previousPeriodCheckins, 'sono');
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Horas de Sono</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(1)}h</span>
                        <span className="text-sm text-muted-foreground">média</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(1)}h
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Cardio */}
              {(() => {
                const currentAvg = calculateAverage(filteredCheckins, 'cardio') * 100;
                const previousAvg = calculateAverage(previousPeriodCheckins, 'cardio') * 100;
                const change = calculatePercentageChange(currentAvg, previousAvg);
                const isPositive = change >= 0;
                
                return (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Cardio</p>
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(change).toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold">{currentAvg.toFixed(0)}%</span>
                        <span className="text-sm text-muted-foreground">realizado</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Anterior: {previousAvg.toFixed(0)}%
                      </p>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

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
          <p className="text-sm text-muted-foreground">
            Acompanhamento dos principais hábitos ao longo do tempo
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart 
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="semana" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tickFormatter={(value) => value === 1 ? "Sim" : value === 0 ? "Não" : ""}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold mb-2">{label}</p>
                        {payload.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: entry.color }}
                            />
                            <span>{entry.name}:</span>
                            <span className="font-semibold">
                              {entry.value === 1 ? "✓ Sim" : "✗ Não"}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="circle"
              />
              <Bar 
                dataKey="treino" 
                fill="#10b981" 
                name="Treino Completo"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="cardio" 
                fill="#3b82f6" 
                name="Cardio Realizado"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="agua" 
                fill="#06b6d4" 
                name="Água Adequada"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="sol" 
                fill="#f59e0b" 
                name="Exposição ao Sol"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Indicadores de Consistência */}
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Consistência dos Hábitos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Percentual de cumprimento no período selecionado
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Treino Completo */}
            {(() => {
              const consistency = (calculateAverage(filteredCheckins, 'treino') * 100);
              const isGood = consistency >= 75;
              const isMedium = consistency >= 50 && consistency < 75;
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Treino Completo</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-red-600'}`}>
                      {consistency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${isGood ? 'bg-green-600' : isMedium ? 'bg-yellow-600' : 'bg-red-600'}`}
                      style={{ width: `${consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(filteredCheckins.length * (consistency / 100))} de {filteredCheckins.length} semanas
                  </p>
                </div>
              );
            })()}

            {/* Cardio Realizado */}
            {(() => {
              const consistency = (calculateAverage(filteredCheckins, 'cardio') * 100);
              const isGood = consistency >= 75;
              const isMedium = consistency >= 50 && consistency < 75;
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Cardio Realizado</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-red-600'}`}>
                      {consistency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${isGood ? 'bg-green-600' : isMedium ? 'bg-yellow-600' : 'bg-red-600'}`}
                      style={{ width: `${consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(filteredCheckins.length * (consistency / 100))} de {filteredCheckins.length} semanas
                  </p>
                </div>
              );
            })()}

            {/* Água Adequada */}
            {(() => {
              const consistency = (calculateAverage(filteredCheckins, 'agua') * 100);
              const isGood = consistency >= 75;
              const isMedium = consistency >= 50 && consistency < 75;
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm font-medium">Água Adequada</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-red-600'}`}>
                      {consistency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${isGood ? 'bg-green-600' : isMedium ? 'bg-yellow-600' : 'bg-red-600'}`}
                      style={{ width: `${consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(filteredCheckins.length * (consistency / 100))} de {filteredCheckins.length} semanas
                  </p>
                </div>
              );
            })()}

            {/* Exposição ao Sol */}
            {(() => {
              const consistency = (calculateAverage(filteredCheckins, 'sol') * 100);
              const isGood = consistency >= 75;
              const isMedium = consistency >= 50 && consistency < 75;
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Exposição ao Sol</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold ${isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-red-600'}`}>
                      {consistency.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${isGood ? 'bg-green-600' : isMedium ? 'bg-yellow-600' : 'bg-red-600'}`}
                      style={{ width: `${consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(filteredCheckins.length * (consistency / 100))} de {filteredCheckins.length} semanas
                  </p>
                </div>
              );
            })()}
          </div>
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
