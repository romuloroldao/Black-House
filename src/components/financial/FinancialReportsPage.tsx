import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { FinancialPageLayout } from "./FinancialPageLayout";
import { FinancialKpiCard } from "./FinancialKpiCard";
import { MoneyDisplay } from "./MoneyDisplay";
import { useFinancialOverviewData, computeFinancialMetrics } from "@/hooks/useFinancialData";

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialReportsPage() {
  const { allPayments, allExpenses, isLoading } = useFinancialOverviewData();
  const metrics = useMemo(
    () => computeFinancialMetrics(allPayments, allExpenses),
    [allPayments, allExpenses],
  );

  const handleExportSummary = () => {
    const now = new Date().toLocaleDateString("pt-BR");
    downloadCsv(`relatorio-financeiro-${now.replace(/\//g, "-")}.csv`, [
      ["Relatório Financeiro Black House", now],
      [],
      ["Métrica", "Valor"],
      ["Receitas recebidas", metrics.totalReceitas.toFixed(2)],
      ["Receitas pendentes", metrics.totalReceitasPendentes.toFixed(2)],
      ["Despesas pagas", metrics.totalDespesas.toFixed(2)],
      ["Despesas pendentes", metrics.totalDespesasPendentes.toFixed(2)],
      ["Lucro líquido", metrics.lucroLiquido.toFixed(2)],
      ["Taxa inadimplência (%)", metrics.taxaInadimplencia.toFixed(1)],
      ["Cobranças atrasadas", String(metrics.paymentsOverdue)],
    ]);
  };

  const handleExportPayments = () => {
    downloadCsv("cobrancas.csv", [
      ["Aluno ID", "Valor", "Status", "Vencimento", "Descrição"],
      ...allPayments.map((p) => [
        p.aluno_id,
        String(p.value),
        p.status,
        p.due_date,
        p.description || "",
      ]),
    ]);
  };

  const handleExportExpenses = () => {
    downloadCsv("despesas.csv", [
      ["Descrição", "Categoria", "Valor", "Status", "Vencimento"],
      ...allExpenses.map((e) => [
        e.descricao || "",
        e.categoria || "",
        String(e.valor),
        e.status,
        e.data_vencimento,
      ]),
    ]);
  };

  if (isLoading) {
    return (
      <FinancialPageLayout title="Relatórios">
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
        </div>
      </FinancialPageLayout>
    );
  }

  return (
    <FinancialPageLayout
      title="Relatórios"
      description="Resumos e exportação de dados financeiros"
      actions={
        <Button onClick={handleExportSummary}>
          <Download className="h-4 w-4 mr-2" />
          Exportar resumo (CSV)
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FinancialKpiCard title="Receitas" value={<MoneyDisplay value={metrics.totalReceitas} />} />
        <FinancialKpiCard title="Despesas" value={<MoneyDisplay value={metrics.totalDespesas} />} />
        <FinancialKpiCard
          title="Lucro"
          value={<MoneyDisplay value={metrics.lucroLiquido} />}
          valueClassName={metrics.lucroLiquido >= 0 ? "text-green-600" : "text-destructive"}
        />
        <FinancialKpiCard title="Inadimplência" value={`${metrics.taxaInadimplencia.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exportar cobranças</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {allPayments.length} registro(s) de cobrança
            </p>
            <Button variant="outline" onClick={handleExportPayments}>
              <Download className="h-4 w-4 mr-2" />
              CSV cobranças
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exportar despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {allExpenses.length} registro(s) de despesa
            </p>
            <Button variant="outline" onClick={handleExportExpenses}>
              <Download className="h-4 w-4 mr-2" />
              CSV despesas
            </Button>
          </CardContent>
        </Card>
      </div>
    </FinancialPageLayout>
  );
}
