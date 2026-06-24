import { FinancialPageLayout } from "./FinancialPageLayout";
import PlanManager from "@/components/PlanManager";

export default function FinancialPlansPage() {
  return (
    <FinancialPageLayout
      title="Planos"
      description="Catálogo de planos de pagamento disponíveis"
    >
      <PlanManager embedded mode="catalog" />
    </FinancialPageLayout>
  );
}
