import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialPageLayout } from "./FinancialPageLayout";
import FinancialExceptionsManager from "@/components/FinancialExceptionsManager";

export default function FinancialSettingsPage() {
  return (
    <FinancialPageLayout
      title="Configurações"
      description="Exceções financeiras, descontos e políticas"
    >
      <Tabs defaultValue="exceptions">
        <TabsList>
          <TabsTrigger value="exceptions">Exceções e isenções</TabsTrigger>
        </TabsList>
        <TabsContent value="exceptions" className="mt-4">
          <FinancialExceptionsManager embedded />
        </TabsContent>
      </Tabs>
    </FinancialPageLayout>
  );
}
