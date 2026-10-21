import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialPageLayout } from "./FinancialPageLayout";
import PlanManager from "@/components/PlanManager";
import RecurringChargesConfig from "@/components/RecurringChargesConfig";

export default function SubscriptionsPage() {
  return (
    <FinancialPageLayout
      title="Assinaturas"
      description="Gerencie assinaturas recorrentes e alunos em planos ativos"
    >
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Assinaturas ativas</TabsTrigger>
          <TabsTrigger value="config">Configurações de recorrência</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
      <PlanManager embedded mode="subscriptions" />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <RecurringChargesConfig />
        </TabsContent>
      </Tabs>
    </FinancialPageLayout>
  );
}
