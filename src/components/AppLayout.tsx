import { useState } from "react";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import StudentManager from "./StudentManager";
import WorkoutManager from "./WorkoutManager";
import VideoGallery from "./VideoGallery";
import NutritionInterface from "./NutritionInterface";

const AppLayout = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

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
        return <div className="p-6"><h1 className="text-3xl font-bold">Mensagens</h1><p className="text-muted-foreground">Chat com alunos em desenvolvimento...</p></div>;
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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default AppLayout;