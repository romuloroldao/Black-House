import { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate, Navigate } from "react-router-dom";
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
import ReportManager from "./ReportManager";
import { ClassGroupManager } from "./ClassGroupManager";
import { AnnouncementManager } from "./AnnouncementManager";
import { EventsCalendar } from "./EventsCalendar";
import SettingsManager from "./SettingsManager";
import UserLinkingManager from "./UserLinkingManager";
import EducationalContentManager from "./educational/EducationalContentManager";
import CoachCheckinInbox from "./coach/CoachCheckinInbox";
import FinancialRouter from "./financial/FinancialRouter";
import { useCoachPortalRealtime } from "@/hooks/useCoachPortalRealtime";
import {
  isFinancialPath,
  pathToFinancialTabId,
  financialTabIdToPath,
  LEGACY_TAB_REDIRECTS,
  FINANCIAL_PATHS,
} from "@/lib/financial-routes";

const AppLayout = () => {
  useCoachPortalRealtime();

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  let tabFromUrl = "dashboard";
  try {
    const tab = searchParams?.get?.("tab");
    if (tab && typeof tab === "string" && tab.trim().length > 0) {
      tabFromUrl = tab;
    }
  } catch {
    tabFromUrl = "dashboard";
  }

  const financialTabFromPath = pathToFinancialTabId(location.pathname);
  const initialTab = financialTabFromPath ?? tabFromUrl;

  const [activeTab, setActiveTab] = useState(initialTab);

  // Redirect tabs legacy para rotas /financeiro/*
  useEffect(() => {
    const legacyRedirect = LEGACY_TAB_REDIRECTS[tabFromUrl];
    if (legacyRedirect && !isFinancialPath(location.pathname)) {
      navigate(legacyRedirect, { replace: true });
      const newTabId = pathToFinancialTabId(legacyRedirect);
      if (newTabId) setActiveTab(newTabId);
    }
  }, [tabFromUrl, location.pathname, navigate]);

  useEffect(() => {
    if (isFinancialPath(location.pathname)) {
      const tabId = pathToFinancialTabId(location.pathname);
      if (tabId) setActiveTab(tabId);
      return;
    }
    try {
      const tab = searchParams?.get?.("tab");
      if (tab && typeof tab === "string" && tab.trim().length > 0) {
        if (!LEGACY_TAB_REDIRECTS[tab]) {
          setActiveTab(tab);
        }
      } else if (location.pathname === "/") {
        setActiveTab("dashboard");
      }
    } catch {
      // manter tab actual
    }
  }, [searchParams, location.pathname]);

  const handleTabChange = (tab: string) => {
    const financialPath = financialTabIdToPath(tab);
    if (financialPath) {
      setActiveTab(tab);
      navigate(financialPath);
      return;
    }
    setActiveTab(tab);
    try {
      if (setSearchParams && typeof setSearchParams === "function") {
        setSearchParams({ tab });
      }
    } catch {
      // não crítico
    }
    if (location.pathname !== "/") {
      navigate(`/?tab=${encodeURIComponent(tab)}`);
    }
  };

  const renderContent = () => {
    if (isFinancialPath(location.pathname)) {
      return <FinancialRouter />;
    }

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
        case "educational-contents":
          return <EducationalContentManager />;
        case "nutrition":
          return <NutritionInterface />;
        case "messages":
          return <div className="p-6"><MessageManager /></div>;
        case "check-ins":
          return <CoachCheckinInbox />;
        case "payment-plans":
          return <Navigate to={FINANCIAL_PATHS.plans} replace />;
        case "payments-tracker":
          return <Navigate to={FINANCIAL_PATHS.charges} replace />;
        case "exceptions":
          return <Navigate to={FINANCIAL_PATHS.settings} replace />;
        case "expenses":
          return <Navigate to={FINANCIAL_PATHS.expenses} replace />;
        case "financial-dashboard":
          return <Navigate to={FINANCIAL_PATHS.overview} replace />;
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
      console.warn("[AppLayout] Erro ao renderizar conteúdo:", error);
      return <Dashboard onTabChange={handleTabChange} />;
    }
  };

  return (
    <RouterSafeComponent
      fallback={
        <div className="flex h-screen bg-background overflow-hidden items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full motion-safe:animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      }
    >
      {(() => {
        try {
          const content = renderContent();
          if (!content) {
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
              <main className="flex-1 overflow-auto max-md:pb-safe-bottom">
                <div className="flex justify-end p-4 md:pr-4 pr-4 pl-16 md:pl-4">
                  <NotificationsPopover onNavigate={handleTabChange} />
                </div>
                {content}
              </main>
            </div>
          );
        } catch (error) {
          console.error("[AppLayout] Erro crítico:", error);
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
