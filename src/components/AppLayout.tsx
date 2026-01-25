import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { RouterSafeComponent } from "./RouterSafeComponent";
import Sidebar from "./Sidebar";
import NotificationsPopover from "./NotificationsPopover";
import Dashboard from "./Dashboard";
import StudentManager from "./StudentManager";
import WorkoutManager from "./WorkoutManager";
import VideoGallery from "./VideoGallery";
import NutritionInterface from "./NutritionInterface";
import MessageManager from "./MessageManager";
import AgendaManager from "./AgendaManager";
import PlanManager from "./PlanManager";
import FinancialExceptionsManager from "./FinancialExceptionsManager";
import ExpenseManager from "./ExpenseManager";
import FinancialDashboard from "./FinancialDashboard";
import PaymentStatusTracker from "./PaymentStatusTracker";
import ReportManager from "./ReportManager";
import { ClassGroupManager } from "./ClassGroupManager";
import { AnnouncementManager } from "./AnnouncementManager";
import { EventsCalendar } from "./EventsCalendar";
import SettingsManager from "./SettingsManager";
import UserLinkingManager from "./UserLinkingManager";


// DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: AppLayout deve renderizar mesmo sem dados
// REACT-RENDER-CRASH-FIX-002: useSearchParams() não deve influenciar render crítico
// REACT-RENDER-CRASH-FIX-002: Fallback absoluto para render inicial
const AppLayout = () => {
  // REACT-RENDER-CRASH-FIX-002: useSearchParams() pode existir, mas não decide render crítico
  const [searchParams, setSearchParams] = useSearchParams();
  
  // REACT-RENDER-CRASH-FIX-002: Valor padrão absoluto - nunca depende de searchParams para render inicial
  // Leitura defensiva: se searchParams falhar, usar "dashboard" como padrão
  let tabFromUrl = "dashboard";
  try {
    const tab = searchParams?.get?.("tab");
    if (tab && typeof tab === 'string' && tab.trim().length > 0) {
      tabFromUrl = tab;
    }
  } catch (error) {
    // REACT-RENDER-CRASH-FIX-002: Se searchParams falhar, usar padrão seguro
    console.warn('[REACT-RENDER-CRASH-FIX-002] Erro ao ler searchParams. Usando padrão "dashboard":', error);
    tabFromUrl = "dashboard";
  }
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    // REACT-RENDER-CRASH-FIX-002: Leitura defensiva de searchParams - não crítico para render
    try {
      const tab = searchParams?.get?.("tab");
      if (tab && typeof tab === 'string' && tab.trim().length > 0) {
        setActiveTab(tab);
      }
    } catch (error) {
      // REACT-RENDER-CRASH-FIX-002: Se searchParams falhar, manter tab atual
      console.warn('[REACT-RENDER-CRASH-FIX-002] Erro ao ler searchParams no useEffect:', error);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    // REACT-RENDER-CRASH-FIX-002: Atualizar estado local primeiro (não depende de Router)
    setActiveTab(tab);
    // REACT-RENDER-CRASH-FIX-002: Atualizar URL de forma não-crítica (pode falhar sem quebrar render)
    try {
      if (setSearchParams && typeof setSearchParams === 'function') {
        setSearchParams({ tab });
      }
    } catch (error) {
      // REACT-RENDER-CRASH-FIX-002: Se setSearchParams falhar, apenas logar - não quebra render
      console.warn('[REACT-RENDER-CRASH-FIX-002] Erro ao atualizar searchParams (não crítico):', error);
    }
  };

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: renderContent deve sempre retornar componente válido
  const renderContent = () => {
    try {
      switch (activeTab) {
        case "dashboard":
          return <Dashboard onTabChange={handleTabChange} />;
        case "students":
          return <StudentManager />;
        case "workouts":
          return <WorkoutManager />;
        case "videos":
          return <VideoGallery />;
        case "nutrition":
          return <NutritionInterface />;
        case "messages":
          return <div className="p-6"><MessageManager /></div>;
        case "payment-plans":
          return <div className="p-6"><PlanManager /></div>;
        case "exceptions":
          return <div className="p-6"><FinancialExceptionsManager /></div>;
        case "expenses":
          return <div className="p-6"><ExpenseManager /></div>;
        case "financial-dashboard":
          return <FinancialDashboard />;
        case "payments-tracker":
          return <div className="p-6"><PaymentStatusTracker /></div>;
        case "calendar":
          return <AgendaManager />;
        case "reports":
          return <ReportManager />;
        case "classes":
          return <div className="p-6"><ClassGroupManager /></div>;
        case "announcements":
          return <div className="p-6"><AnnouncementManager /></div>;
        case "events":
          return <div className="p-6"><EventsCalendar /></div>;
        case "user-linking":
          return <div className="p-6"><UserLinkingManager /></div>;
        case "analytics":
          return <div className="p-6"><h1 className="text-3xl font-bold">Análises</h1><p className="text-muted-foreground">Análises detalhadas em desenvolvimento...</p></div>;
        case "settings":
          return <SettingsManager />;
        default:
          return <Dashboard onTabChange={handleTabChange} />;
      }
    } catch (error) {
      // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Fallback seguro em caso de erro
      console.warn('[DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001] Erro ao renderizar conteúdo. Usando fallback:', error);
      return <Dashboard onTabChange={handleTabChange} />;
    }
  };

  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Layout deve sempre renderizar estrutura base
  // DESIGN-ROOT-RENDER-UNBLOCK-001: Garantir que sempre retorna JSX válido
  // REACT-RENDER-CRASH-FIX-002: Envolver com RouterSafeComponent para garantir Router disponível
  return (
    <RouterSafeComponent
      fallback={
        <div className="flex h-screen bg-background overflow-hidden items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      }
    >
      {(() => {
        try {
          // DESIGN-ROOT-RENDER-UNBLOCK-001: Validar que renderContent retorna JSX válido
          const content = renderContent();
          if (!content) {
            // DESIGN-ROOT-RENDER-UNBLOCK-001: Se renderContent retornar null/undefined, usar fallback
            console.warn('[DESIGN-ROOT-RENDER-UNBLOCK-001] renderContent retornou null/undefined. Usando fallback.');
            return (
              <div className="flex h-screen bg-background overflow-hidden items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              </div>
            );
          }

          return (
            <div className="flex h-screen bg-background overflow-hidden">
              <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
              <main className="flex-1 overflow-auto">
                <div className="flex justify-end p-4 md:pr-4 pr-4 pl-16 md:pl-4">
                  <NotificationsPopover onNavigate={handleTabChange} />
                </div>
                {content}
              </main>
            </div>
          );
        } catch (error) {
          // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Fallback mínimo se houver erro estrutural
          // DESIGN-ROOT-RENDER-UNBLOCK-001: Garantir que fallback sempre retorna JSX válido
          console.error('[DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001] Erro crítico no AppLayout:', error);
          return (
            <div className="flex h-screen bg-background overflow-hidden items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            </div>
          );
        }
      })()}
    </RouterSafeComponent>
  );
};

export default AppLayout;