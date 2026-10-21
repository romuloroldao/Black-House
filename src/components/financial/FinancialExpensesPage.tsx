import { FinancialPageLayout } from "./FinancialPageLayout";
import ExpenseManager from "@/components/ExpenseManager";

export default function FinancialExpensesPage() {
  return (
    <FinancialPageLayout
      title="Despesas"
      description="Gerencie contas a pagar e despesas do negócio"
    >
      <ExpenseManager />
    </FinancialPageLayout>
  );
}
