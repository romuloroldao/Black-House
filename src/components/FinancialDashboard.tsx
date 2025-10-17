import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PaymentData {
  id: string;
  value: number;
  status: string;
  due_date: string;
  description: string;
  aluno_id: string;
  alunos?: { nome: string };
}

interface ExpenseData {
  id: string;
  valor: number;
  status: string;
  data_vencimento: string;
  descricao: string;
  categoria: string;
}

interface MonthlyData {
  month: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

export default function FinancialDashboard() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFinancialData();
    }
  }, [user]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);

      // Buscar pagamentos dos últimos 6 meses
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("asaas_payments")
        .select(`
          *,
          alunos:aluno_id(nome)
        `)
        .eq("coach_id", user?.id)
        .gte("due_date", sixMonthsAgo.toISOString().split("T")[0])
        .order("due_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("coach_id", user?.id)
        .gte("data_vencimento", sixMonthsAgo.toISOString().split("T")[0])
        .order("data_vencimento", { ascending: false });

      if (expensesError) throw expensesError;

      setPayments(paymentsData || []);
      setExpenses(expensesData || []);
    } catch (error) {
      console.error("Error loading financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const totalReceitas = payments
      .filter((p) => p.status === "RECEIVED")
      .reduce((sum, p) => sum + Number(p.value), 0);

    const totalReceitasPendentes = payments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + Number(p.value), 0);

    const totalDespesas = expenses
      .filter((e) => e.status === "pago")
      .reduce((sum, e) => sum + Number(e.valor), 0);

    const totalDespesasPendentes = expenses
      .filter((e) => e.status === "pendente")
      .reduce((sum, e) => sum + Number(e.valor), 0);

    const lucroLiquido = totalReceitas - totalDespesas;

    const paymentsOverdue = payments.filter(
      (p) => p.status === "PENDING" && new Date(p.due_date) < new Date()
    ).length;

    const taxaInadimplencia =
      payments.length > 0 ? (paymentsOverdue / payments.length) * 100 : 0;

    return {
      totalReceitas,
      totalReceitasPendentes,
      totalDespesas,
      totalDespesasPendentes,
      lucroLiquido,
      taxaInadimplencia,
      paymentsOverdue,
    };
  };

  const getMonthlyData = (): MonthlyData[] => {
    const monthlyMap = new Map<string, { receitas: number; despesas: number }>();

    payments.forEach((p) => {
      if (p.status === "RECEIVED") {
        const month = new Date(p.due_date).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        });
        const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
        monthlyMap.set(month, {
          ...current,
          receitas: current.receitas + Number(p.value),
        });
      }
    });

    expenses.forEach((e) => {
      if (e.status === "pago") {
        const month = new Date(e.data_vencimento).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        });
        const current = monthlyMap.get(month) || { receitas: 0, despesas: 0 };
        monthlyMap.set(month, {
          ...current,
          despesas: current.despesas + Number(e.valor),
        });
      }
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        receitas: data.receitas,
        despesas: data.despesas,
        lucro: data.receitas - data.despesas,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const getCategoryData = () => {
    const categoryMap = new Map<string, number>();

    expenses.forEach((e) => {
      if (e.status === "pago") {
        const current = categoryMap.get(e.categoria) || 0;
        categoryMap.set(e.categoria, current + Number(e.valor));
      }
    });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  };

  if (loading) {
    return <div className="p-8">Carregando dados financeiros...</div>;
  }

  const metrics = calculateMetrics();
  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard Financeiro</h2>
        <p className="text-muted-foreground">
          Visão geral das suas finanças
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Receitas Recebidas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics.totalReceitas.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pendentes: R$ {metrics.totalReceitasPendentes.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Pagas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics.totalDespesas.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pendentes: R$ {metrics.totalDespesasPendentes.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                metrics.lucroLiquido >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              R$ {metrics.lucroLiquido.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Inadimplência
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.taxaInadimplencia.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.paymentsOverdue} pagamentos atrasados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receitas vs Despesas (Últimos 6 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="receitas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Receitas"
                  />
                  <Line
                    type="monotone"
                    dataKey="despesas"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    name="Despesas"
                  />
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    name="Lucro"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) =>
                      `${name}: R$ ${value.toFixed(2)}`
                    }
                    outerRadius={100}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagamentos Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payments.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div>
                  <p className="font-medium">{payment.alunos?.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {payment.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">R$ {Number(payment.value).toFixed(2)}</p>
                  <Badge
                    variant={
                      payment.status === "RECEIVED"
                        ? "default"
                        : payment.status === "PENDING"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
