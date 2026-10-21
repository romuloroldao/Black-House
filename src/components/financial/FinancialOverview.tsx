import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Plus,
  CreditCard,
  Receipt,
} from "lucide-react";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { FinancialKpiCard } from "./FinancialKpiCard";
import { IntegrationHealthBanner } from "./IntegrationHealthBanner";
import { MoneyDisplay } from "./MoneyDisplay";
import { FinancialStatusBadge } from "./FinancialStatusBadge";
import {
  useFinancialOverviewData,
  buildStudentPaymentSummary,
  computeFinancialMetrics,
  getMonthlyCashFlow,
} from "@/hooks/useFinancialData";
import { FINANCIAL_PATHS } from "@/lib/financial-routes";

export default function FinancialOverview() {
  const navigate = useNavigate();
  const { payments, allPayments, expenses, alunos, health, isLoading } = useFinancialOverviewData();

  if (isLoading) {
    return (
      <FinancialPageLayout title="Visão Geral" description="Carregando...">
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      </FinancialPageLayout>
    );
  }

  const metrics = computeFinancialMetrics(payments, expenses);
  const monthlyData = getMonthlyCashFlow(payments, expenses);
  const students = buildStudentPaymentSummary(alunos, allPayments);
  const needsAttention = students.filter((s) => s.overdueCount > 0).slice(0, 5);

  const recentActivity = [...allPayments]
    .sort((a, b) => new Date(b.created_at || b.due_date).getTime() - new Date(a.created_at || a.due_date).getTime())
    .slice(0, 8)
    .map((p) => {
      const aluno = alunos.find((a) => a.id === p.aluno_id);
      return { ...p, alunoNome: aluno?.nome || "Aluno" };
    });

  return (
    <FinancialPageLayout
      title="Visão Geral"
      description="Resumo financeiro do seu negócio"
    >
      <IntegrationHealthBanner health={health} compact />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <FinancialKpiCard
          title="Recebido"
          value={<MoneyDisplay value={metrics.totalReceitas} />}
          subtitle={`A receber: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalReceitasPendentes)}`}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
        />
        <FinancialKpiCard
          title="Despesas pagas"
          value={<MoneyDisplay value={metrics.totalDespesas} />}
          subtitle={`Pendentes: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalDespesasPendentes)}`}
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
        />
        <FinancialKpiCard
          title="Lucro líquido"
          value={<MoneyDisplay value={metrics.lucroLiquido} showSign />}
          valueClassName={metrics.lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <FinancialKpiCard
          title="Inadimplência"
          value={`${metrics.taxaInadimplencia.toFixed(1)}%`}
          subtitle={`${metrics.paymentsOverdue} cobrança(s) atrasada(s)`}
          icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
        />
        <FinancialKpiCard
          title="Alunos"
          value={students.length}
          subtitle={`${needsAttention.length} precisam de atenção`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button className="justify-start gap-2" onClick={() => navigate(FINANCIAL_PATHS.charges)}>
              <Plus className="h-4 w-4" />
              Nova cobrança
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => navigate(FINANCIAL_PATHS.expenses)}>
              <Receipt className="h-4 w-4" />
              Nova despesa
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => navigate(FINANCIAL_PATHS.charges)}>
              <CreditCard className="h-4 w-4" />
              Ver cobranças
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Atividade recente</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={FINANCIAL_PATHS.cashFlow}>Ver fluxo</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação recente</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{item.alunoNome}</span>
                      <span className="text-muted-foreground ml-2">{item.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay value={Number(item.value)} />
                      <FinancialStatusBadge status={item.status} dueDate={item.due_date} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {needsAttention.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-destructive">Precisa de atenção</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to={FINANCIAL_PATHS.charges}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {needsAttention.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link to={`/alunos/${s.id}`} className="font-medium hover:underline">
                    {s.nome}
                  </Link>
                  <span className="text-destructive">{s.overdueCount} atrasada(s)</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs despesas (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)} />
              <Line type="monotone" dataKey="receitas" stroke="hsl(var(--primary))" strokeWidth={2} name="Receitas" />
              <Line type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" strokeWidth={2} name="Despesas" />
              <Line type="monotone" dataKey="lucro" stroke="hsl(var(--secondary))" strokeWidth={2} name="Lucro" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </FinancialPageLayout>
  );
}
