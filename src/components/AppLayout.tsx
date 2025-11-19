import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationsPopover from "./NotificationsPopover";
import Dashboard from "./Dashboard";
import StudentManager from "./StudentManager";
import WorkoutManager from "./WorkoutManager";
import VideoGallery from "./VideoGallery";
import NutritionInterface from "./NutritionInterface";
import MessageManager from "./MessageManager";
import AgendaManager from "./AgendaManager";
import PaymentManager from "./PaymentManager";
import PlanManager from "./PlanManager";
import FinancialExceptionsManager from "./FinancialExceptionsManager";
import ExpenseManager from "./ExpenseManager";
import RecurringChargesConfig from "./RecurringChargesConfig";
import FinancialDashboard from "./FinancialDashboard";
import PaymentStatusTracker from "./PaymentStatusTracker";
import ReportManager from "./ReportManager";
import { ClassGroupManager } from "./ClassGroupManager";
import { AnnouncementManager } from "./AnnouncementManager";
import { EventsCalendar } from "./EventsCalendar";
import SettingsManager from "./SettingsManager";

const AppLayout = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const renderContent = () => {
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
      case "payments":
        return <PaymentManager />;
      case "exceptions":
        return <div className="p-6"><FinancialExceptionsManager /></div>;
      case "expenses":
        return <div className="p-6"><ExpenseManager /></div>;
      case "recurring-charges":
        return <div className="p-6"><RecurringChargesConfig /></div>;
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
      case "analytics":
        return <div className="p-6"><h1 className="text-3xl font-bold">Análises</h1><p className="text-muted-foreground">Análises detalhadas em desenvolvimento...</p></div>;
      case "settings":
        return <SettingsManager />;
      default:
        return <Dashboard onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end p-4 md:pr-4 pr-4 pl-16 md:pl-4">
          <NotificationsPopover onNavigate={handleTabChange} />
        </div>
        {renderContent()}
      </main>
    </div>
  );
};

export default AppLayout;