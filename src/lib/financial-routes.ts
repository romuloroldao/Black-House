/** Rotas semânticas do hub Financeiro */
export const FINANCIAL_PATHS = {
  overview: "/financeiro",
  charges: "/financeiro/cobrancas",
  subscriptions: "/financeiro/assinaturas",
  plans: "/financeiro/planos",
  clients: "/financeiro/clientes",
  expenses: "/financeiro/despesas",
  cashFlow: "/financeiro/fluxo-de-caixa",
  reports: "/financeiro/relatorios",
  integration: "/financeiro/integracao",
  settings: "/financeiro/configuracoes",
} as const;

export type FinancialPath = (typeof FINANCIAL_PATHS)[keyof typeof FINANCIAL_PATHS];

/** IDs usados no Sidebar para estado activo */
export const FINANCIAL_TAB_IDS = {
  overview: "financeiro-overview",
  charges: "financeiro-cobrancas",
  subscriptions: "financeiro-assinaturas",
  plans: "financeiro-planos",
  clients: "financeiro-clientes",
  expenses: "financeiro-despesas",
  cashFlow: "financeiro-fluxo",
  reports: "financeiro-relatorios",
  integration: "financeiro-integracao",
  settings: "financeiro-configuracoes",
} as const;

/** Redirect de tabs legacy (?tab=) para rotas semânticas */
export const LEGACY_TAB_REDIRECTS: Record<string, FinancialPath> = {
  "financial-dashboard": FINANCIAL_PATHS.overview,
  "payments-tracker": FINANCIAL_PATHS.charges,
  "payment-plans": FINANCIAL_PATHS.plans,
  expenses: FINANCIAL_PATHS.expenses,
  exceptions: FINANCIAL_PATHS.settings,
};

export function pathToFinancialTabId(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, "") || "/financeiro";
  const map: Record<string, string> = {
    [FINANCIAL_PATHS.overview]: FINANCIAL_TAB_IDS.overview,
    [FINANCIAL_PATHS.charges]: FINANCIAL_TAB_IDS.charges,
    [FINANCIAL_PATHS.subscriptions]: FINANCIAL_TAB_IDS.subscriptions,
    [FINANCIAL_PATHS.plans]: FINANCIAL_TAB_IDS.plans,
    [FINANCIAL_PATHS.clients]: FINANCIAL_TAB_IDS.clients,
    [FINANCIAL_PATHS.expenses]: FINANCIAL_TAB_IDS.expenses,
    [FINANCIAL_PATHS.cashFlow]: FINANCIAL_TAB_IDS.cashFlow,
    [FINANCIAL_PATHS.reports]: FINANCIAL_TAB_IDS.reports,
    [FINANCIAL_PATHS.integration]: FINANCIAL_TAB_IDS.integration,
    [FINANCIAL_PATHS.settings]: FINANCIAL_TAB_IDS.settings,
  };
  return map[normalized] ?? null;
}

export function financialTabIdToPath(tabId: string): FinancialPath | null {
  const map: Record<string, FinancialPath> = {
    [FINANCIAL_TAB_IDS.overview]: FINANCIAL_PATHS.overview,
    [FINANCIAL_TAB_IDS.charges]: FINANCIAL_PATHS.charges,
    [FINANCIAL_TAB_IDS.subscriptions]: FINANCIAL_PATHS.subscriptions,
    [FINANCIAL_TAB_IDS.plans]: FINANCIAL_PATHS.plans,
    [FINANCIAL_TAB_IDS.clients]: FINANCIAL_PATHS.clients,
    [FINANCIAL_TAB_IDS.expenses]: FINANCIAL_PATHS.expenses,
    [FINANCIAL_TAB_IDS.cashFlow]: FINANCIAL_PATHS.cashFlow,
    [FINANCIAL_TAB_IDS.reports]: FINANCIAL_PATHS.reports,
    [FINANCIAL_TAB_IDS.integration]: FINANCIAL_PATHS.integration,
    [FINANCIAL_TAB_IDS.settings]: FINANCIAL_PATHS.settings,
  };
  return map[tabId] ?? null;
}

export function isFinancialPath(pathname: string): boolean {
  return pathname === "/financeiro" || pathname.startsWith("/financeiro/");
}
