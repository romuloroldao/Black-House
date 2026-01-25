import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

interface StudentPayment {
  id: string;
  nome: string;
  email: string;
  pendingCount: number;
  overdueCount: number;
  totalPaid: number;
  lastPaymentDate: string | null;
}

interface Payment {
  id: string;
  aluno_id: string;
  value: number;
  status: string;
  due_date: string;
  description: string;
  alunos?: { nome: string; email: string };
}

export default function FinancialDashboard() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [studentPayments, setStudentPayments] = useState<StudentPayment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFinancialData();
    }
  }, [user]);

  const loadFinancialData = async () => {
    setLoading(true);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString().split("T")[0];

    const [paymentsResult, expensesResult, alunosResult] = await Promise.all([
      apiClient.requestSafe<any[]>('/api/asaas-payments'),
      apiClient.requestSafe<any[]>('/api/expenses'),
      apiClient.requestSafe<any[]>('/api/alunos'),
    ]);

    const paymentsData = paymentsResult.success && Array.isArray(paymentsResult.data) ? paymentsResult.data : [];
    const expensesData = expensesResult.success && Array.isArray(expensesResult.data) ? expensesResult.data : [];
    const alunosData = alunosResult.success && Array.isArray(alunosResult.data) ? alunosResult.data : [];
    const alunosMap = new Map(alunosData.map((a: any) => [a.id, a]));

    const paymentsComAlunos = paymentsData
      .filter((p: any) => p.coach_id === user?.id && p.due_date >= cutoffDate)
      .sort((a: any, b: any) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime())
      .map((payment: any) => {
        const aluno = alunosMap.get(payment.aluno_id);
        return { ...payment, alunos: aluno ? { nome: aluno.nome } : null };
      });

    const expensesNormalized = expensesData
      .filter((e: any) => e.coach_id === user?.id && e.data_vencimento >= cutoffDate)
      .sort((a: any, b: any) => new Date(b.data_vencimento || 0).getTime() - new Date(a.data_vencimento || 0).getTime())
      .map((expense: any) => ({
        ...expense,
        valor: typeof expense.valor === 'string' ? parseFloat(expense.valor) || 0 : (expense.valor || 0),
      }));

    setPayments(paymentsComAlunos);
    setExpenses(expensesNormalized);
    await loadPaymentData();
    setLoading(false);
  };

  const loadPaymentData = async () => {
    const [alunosResult, paymentsResult] = await Promise.all([
      apiClient.requestSafe<any[]>('/api/alunos'),
      apiClient.requestSafe<any[]>('/api/asaas-payments'),
    ]);

    const alunos = alunosResult.success && Array.isArray(alunosResult.data)
      ? alunosResult.data.filter((a: any) => a.coach_id === user?.id)
      : [];
    const payments = paymentsResult.success && Array.isArray(paymentsResult.data)
      ? paymentsResult.data.filter((p: any) => p.coach_id === user?.id)
      : [];

    const alunosMap = new Map(alunos.map((a: any) => [a.id, a]));
    const paymentsComAlunos = payments.map((payment: any) => {
      const aluno = alunosMap.get(payment.aluno_id);
      return {
        ...payment,
        alunos: aluno ? { nome: aluno.nome, email: aluno.email } : null
      };
    });
    setAllPayments(paymentsComAlunos);

    const studentPaymentsMap = new Map<string, StudentPayment>();
    alunos.forEach((aluno: any) => {
      studentPaymentsMap.set(aluno.id, {
        id: aluno.id,
        nome: aluno.nome || "Sem nome",
        email: aluno.email,
        pendingCount: 0,
        overdueCount: 0,
        totalPaid: 0,
        lastPaymentDate: null,
      });
    });

    const today = new Date();
    payments.forEach((payment: any) => {
      const student = studentPaymentsMap.get(payment.aluno_id);
      if (student) {
        if (payment.status === "RECEIVED") {
          student.totalPaid += Number(payment.value);
          if (!student.lastPaymentDate || new Date(payment.due_date) > new Date(student.lastPaymentDate)) {
            student.lastPaymentDate = payment.due_date;
          }
        } else if (payment.status === "PENDING") {
          const dueDate = new Date(payment.due_date);
          if (dueDate < today) {
            student.overdueCount++;
          } else {
            student.pendingCount++;
          }
        }
      }
    });

    setStudentPayments(Array.from(studentPaymentsMap.values()));
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

  const getStatusBadge = (student: StudentPayment) => {
    if (student.overdueCount > 0) {
      return <Badge variant="destructive">Atrasado</Badge>;
    } else if (student.pendingCount > 0) {
      return <Badge variant="secondary">Pendente</Badge>;
    } else if (student.totalPaid > 0) {
      return <Badge variant="default">Em Dia</Badge>;
    }
    return <Badge variant="outline">Sem Pagamentos</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filterStudents = (filter: string) => {
    let filtered = studentPayments;

    if (filter === "overdue") {
      filtered = filtered.filter((s) => s.overdueCount > 0);
    } else if (filter === "pending") {
      filtered = filtered.filter((s) => s.pendingCount > 0 && s.overdueCount === 0);
    } else if (filter === "on-time") {
      filtered = filtered.filter(
        (s) => s.overdueCount === 0 && s.pendingCount === 0 && s.totalPaid > 0
      );
    }

    if (searchFilter) {
      filtered = filtered.filter(
        (s) =>
          s.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
          s.email.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    return filtered;
  };

  const getPaymentHistory = () => {
    return allPayments
      .map((payment) => ({
        ...payment,
        studentName: payment.alunos?.nome || "Desconhecido",
      }))
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  };

  const studentsWithOverdue = studentPayments.filter((s) => s.overdueCount > 0).length;
  const studentsWithPending = studentPayments.filter(
    (s) => s.pendingCount > 0 && s.overdueCount === 0
  ).length;
  const studentsOnTime = studentPayments.filter(
    (s) => s.overdueCount === 0 && s.pendingCount === 0 && s.totalPaid > 0
  ).length;

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

      {/* Tabs de Visualização */}
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Status dos Alunos</TabsTrigger>
          <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          {/* Métricas de Alunos */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentPayments.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {studentsWithOverdue}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary">
                  {studentsWithPending}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Dia</CardTitle>
                <CheckCircle className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {studentsOnTime}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtro de Busca */}
          <Card>
            <CardHeader>
              <CardTitle>Filtrar Alunos</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Tabs de Status */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">Todos ({studentPayments.length})</TabsTrigger>
              <TabsTrigger value="overdue">
                Atrasados ({studentsWithOverdue})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pendentes ({studentsWithPending})
              </TabsTrigger>
              <TabsTrigger value="on-time">Em Dia ({studentsOnTime})</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {["all", "overdue", "pending", "on-time"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {filterStudents(tab).map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between border-b pb-4 last:border-0"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{student.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.email}
                            </p>
                            <div className="flex gap-4 text-sm">
                              {student.overdueCount > 0 && (
                                <span className="text-destructive">
                                  {student.overdueCount} atrasado(s)
                                </span>
                              )}
                              {student.pendingCount > 0 && (
                                <span className="text-secondary">
                                  {student.pendingCount} pendente(s)
                                </span>
                              )}
                              {student.totalPaid > 0 && (
                                <span className="text-muted-foreground">
                                  Total pago: {formatCurrency(student.totalPaid)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(student)}
                            {student.lastPaymentDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Último pgto:{" "}
                                {new Date(student.lastPaymentDate).toLocaleDateString(
                                  "pt-BR"
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {filterStudents(tab).length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum aluno encontrado
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getPaymentHistory().slice(0, 20).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between border-b pb-4 last:border-0"
                      >
                        <div>
                          <p className="font-medium">{payment.studentName}</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento:{" "}
                            {new Date(payment.due_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {formatCurrency(Number(payment.value))}
                          </p>
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
            </TabsContent>
          </Tabs>
        </TabsContent>

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
