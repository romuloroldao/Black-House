import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

const SIX_MONTHS_AGO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split("T")[0];
};

export function useFinancialPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial", "payments", user?.id],
    queryFn: async () => {
      const result = await apiClient.requestSafe<any[]>("/api/asaas-payments");
      if (!result.success || !Array.isArray(result.data)) return [];
      return result.data.filter((p: any) => p.coach_id === user?.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useFinancialExpenses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial", "expenses", user?.id],
    queryFn: async () => {
      const result = await apiClient.requestSafe<any[]>("/api/expenses");
      if (!result.success || !Array.isArray(result.data)) return [];
      return result.data
        .filter((e: any) => e.coach_id === user?.id)
        .map((e: any) => ({
          ...e,
          valor: typeof e.valor === "string" ? parseFloat(e.valor) || 0 : e.valor || 0,
        }));
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useFinancialAlunos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial", "alunos", user?.id],
    queryFn: async () => {
      const result = await apiClient.requestSafe<any[]>("/api/alunos");
      if (!result.success || !Array.isArray(result.data)) return [];
      return result.data.filter((a: any) => a.coach_id === user?.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useFinancialHealth() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial", "health", user?.id],
    queryFn: async () => {
      const result = await apiClient.requestSafe<any>("/api/financial/health");
      if (!result.success || !result.data) return null;
      return {
        initial_sync_status: result.data.config?.initial_sync_status,
        orphans_count: result.data.orphans_count,
        conflicts_count: result.data.conflicts_count,
        inbox_pending_count: result.data.inbox_pending_count,
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useFinancialOverviewData() {
  const payments = useFinancialPayments();
  const expenses = useFinancialExpenses();
  const alunos = useFinancialAlunos();
  const health = useFinancialHealth();

  const cutoff = SIX_MONTHS_AGO();
  const recentPayments = (payments.data ?? []).filter((p) => p.due_date >= cutoff);
  const recentExpenses = (expenses.data ?? []).filter((e) => e.data_vencimento >= cutoff);

  const isLoading = payments.isLoading || expenses.isLoading || alunos.isLoading;

  return {
    payments: recentPayments,
    allPayments: payments.data ?? [],
    expenses: recentExpenses,
    allExpenses: expenses.data ?? [],
    alunos: alunos.data ?? [],
    health: health.data ?? null,
    isLoading,
    refetch: () => {
      payments.refetch();
      expenses.refetch();
      alunos.refetch();
      health.refetch();
    },
  };
}

export function buildStudentPaymentSummary(
  alunos: any[],
  payments: any[],
) {
  const today = new Date();
  return alunos.map((aluno) => {
    const alunoPayments = payments.filter((p) => p.aluno_id === aluno.id);
    const pagamentosPagos = alunoPayments.filter((p) => p.status === "RECEIVED" || p.status === "CONFIRMED");
    const pagamentosPendentes = alunoPayments.filter((p) => p.status === "PENDING");
    const pagamentosAtrasados = pagamentosPendentes.filter(
      (p) => new Date(p.due_date) < today,
    );
    const totalPago = pagamentosPagos.reduce((sum, p) => sum + Number(p.value), 0);
    const ultimo = alunoPayments.sort(
      (a, b) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime(),
    )[0];

    return {
      id: aluno.id,
      nome: aluno.nome || "Sem nome",
      email: aluno.email,
      plano: aluno.plano,
      pendingCount: pagamentosPendentes.length - pagamentosAtrasados.length,
      overdueCount: pagamentosAtrasados.length,
      totalPaid: totalPago,
      lastPaymentDate: ultimo?.due_date || null,
    };
  });
}

export function computeFinancialMetrics(payments: any[], expenses: any[]) {
  const today = new Date();
  const totalReceitas = payments
    .filter((p) => p.status === "RECEIVED" || p.status === "CONFIRMED")
    .reduce((sum, p) => sum + Number(p.value), 0);
  const totalReceitasPendentes = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + Number(p.value), 0);
  const totalDespesas = expenses
    .filter((e) => e.status === "pago")
    .reduce((sum, e) => sum + Number(e.valor), 0);
  const totalDespesasPendentes = expenses
    .filter((e) => e.status === "pendente" || e.status === "atrasada")
    .reduce((sum, e) => sum + Number(e.valor), 0);
  const paymentsOverdue = payments.filter(
    (p) => p.status === "PENDING" && new Date(p.due_date) < today,
  ).length;
  const taxaInadimplencia =
    payments.length > 0 ? (paymentsOverdue / payments.length) * 100 : 0;

  return {
    totalReceitas,
    totalReceitasPendentes,
    totalDespesas,
    totalDespesasPendentes,
    lucroLiquido: totalReceitas - totalDespesas,
    taxaInadimplencia,
    paymentsOverdue,
  };
}

export function getMonthlyCashFlow(payments: any[], expenses: any[]) {
  const monthlyMap = new Map<string, { receitas: number; despesas: number; label: string }>();

  payments.forEach((p) => {
    if (p.status === "RECEIVED" || p.status === "CONFIRMED") {
      const d = new Date(p.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      const cur = monthlyMap.get(key) || { receitas: 0, despesas: 0, label };
      monthlyMap.set(key, { ...cur, receitas: cur.receitas + Number(p.value) });
    }
  });

  expenses.forEach((e) => {
    if (e.status === "pago") {
      const d = new Date(e.data_vencimento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
      const cur = monthlyMap.get(key) || { receitas: 0, despesas: 0, label };
      monthlyMap.set(key, { ...cur, despesas: cur.despesas + Number(e.valor) });
    }
  });

  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      monthKey: key,
      month: data.label,
      receitas: data.receitas,
      despesas: data.despesas,
      lucro: data.receitas - data.despesas,
    }));
}
