import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import StudentManager from "./StudentManager";
import WorkoutManager from "./WorkoutManager";
import VideoGallery from "./VideoGallery";
import NutritionInterface from "./NutritionInterface";
import MessageManager from "./MessageManager";

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
        return <Dashboard />;
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
      case "payments":
        return <div className="p-6"><h1 className="text-3xl font-bold">Pagamentos</h1><p className="text-muted-foreground">Gestão financeira em desenvolvimento...</p></div>;
      case "calendar":
        return <div className="p-6"><h1 className="text-3xl font-bold">Agenda</h1><p className="text-muted-foreground">Calendário de compromissos em desenvolvimento...</p></div>;
      case "lives":
        return <div className="p-6"><h1 className="text-3xl font-bold">Lives</h1><p className="text-muted-foreground">Transmissões ao vivo em desenvolvimento...</p></div>;
      case "analytics":
        return <div className="p-6"><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Analytics e relatórios em desenvolvimento...</p></div>;
      case "settings":
        return <div className="p-6"><h1 className="text-3xl font-bold">Configurações</h1><p className="text-muted-foreground">Configurações do sistema em desenvolvimento...</p></div>;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default AppLayout;