import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { FinancialDataTable, type ColumnDef } from "./FinancialDataTable";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancialOverviewData, getMonthlyCashFlow } from "@/hooks/useFinancialData";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface FlowRow {
  id: string;
  date: string;
  type: string;
  description: string;
  entrada: number;
  saida: number;
}

export default function CashFlowPage() {
  const { allPayments, allExpenses, isLoading } = useFinancialOverviewData();

  const monthlyData = useMemo(
    () => getMonthlyCashFlow(allPayments, allExpenses),
    [allPayments, allExpenses],
  );

  const ledger: FlowRow[] = useMemo(() => {
    const rows: FlowRow[] = [];
    allPayments.forEach((p) => {
      if (p.status === "RECEIVED" || p.status === "CONFIRMED") {
        rows.push({
          id: `p-${p.id}`,
          date: p.due_date,
          type: "Receita",
          description: p.description || "Cobrança",
          entrada: Number(p.value),
          saida: 0,
        });
      }
    });
    allExpenses.forEach((e) => {
      if (e.status === "pago") {
        rows.push({
          id: `e-${e.id}`,
          date: e.data_vencimento,
          type: "Despesa",
          description: e.descricao || e.categoria,
          entrada: 0,
          saida: Number(e.valor),
        });
      }
    });
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allPayments, allExpenses]);

  const columns: ColumnDef<FlowRow, unknown>[] = [
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString("pt-BR"),
    },
    { accessorKey: "type", header: "Tipo" },
    { accessorKey: "description", header: "Descrição" },
    {
      accessorKey: "entrada",
      header: "Entrada",
      cell: ({ row }) =>
        row.original.entrada > 0 ? <MoneyDisplay value={row.original.entrada} className="text-green-600" /> : "—",
    },
    {
      accessorKey: "saida",
      header: "Saída",
      cell: ({ row }) =>
        row.original.saida > 0 ? <MoneyDisplay value={row.original.saida} className="text-destructive" /> : "—",
    },
  ];

  if (isLoading) {
    return (
      <FinancialPageLayout title="Fluxo de Caixa">
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      </FinancialPageLayout>
    );
  }

  return (
    <FinancialPageLayout
      title="Fluxo de Caixa"
      description="Histórico de entradas e saídas"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs despesas por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)} />
              <Legend />
              <Bar dataKey="receitas" fill="hsl(var(--primary))" name="Receitas" />
              <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <FinancialDataTable data={ledger} columns={columns} pageSize={20} emptyMessage="Nenhuma movimentação" />
    </FinancialPageLayout>
  );
}
