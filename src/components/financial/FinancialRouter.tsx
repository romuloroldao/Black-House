import { useLocation, Navigate } from "react-router-dom";
import { FINANCIAL_PATHS } from "@/lib/financial-routes";
import FinancialOverview from "./FinancialOverview";
import ChargesPage from "./ChargesPage";
import SubscriptionsPage from "./SubscriptionsPage";
import FinancialPlansPage from "./FinancialPlansPage";
import FinancialClientsPage from "./FinancialClientsPage";
import FinancialExpensesPage from "./FinancialExpensesPage";
import CashFlowPage from "./CashFlowPage";
import FinancialReportsPage from "./FinancialReportsPage";
import AsaasIntegrationPage from "./AsaasIntegrationPage";
import FinancialSettingsPage from "./FinancialSettingsPage";

export default function FinancialRouter() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, "") || FINANCIAL_PATHS.overview;

  switch (path) {
    case FINANCIAL_PATHS.overview:
      return <FinancialOverview />;
    case FINANCIAL_PATHS.charges:
      return <ChargesPage />;
    case FINANCIAL_PATHS.subscriptions:
      return <SubscriptionsPage />;
    case FINANCIAL_PATHS.plans:
      return <FinancialPlansPage />;
    case FINANCIAL_PATHS.clients:
      return <FinancialClientsPage />;
    case FINANCIAL_PATHS.expenses:
      return <FinancialExpensesPage />;
    case FINANCIAL_PATHS.cashFlow:
      return <CashFlowPage />;
    case FINANCIAL_PATHS.reports:
      return <FinancialReportsPage />;
    case FINANCIAL_PATHS.integration:
      return <AsaasIntegrationPage />;
    case FINANCIAL_PATHS.settings:
      return <FinancialSettingsPage />;
    default:
      return <Navigate to={FINANCIAL_PATHS.overview} replace />;
  }
}
