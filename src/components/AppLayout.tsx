import { useState } from "react";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import StudentManager from "./StudentManager";
import WorkoutManager from "./WorkoutManager";
import VideoGallery from "./VideoGallery";
import NutritionManager from "./NutritionManager";
import DietCreator from "./DietCreator";
import DietViewer from "./DietViewer";

const AppLayout = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState("foods");

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
        return (
          <div className="space-y-6">
            <div className="border-b bg-card">
              <div className="flex space-x-8 px-6">
                <button 
                  className={`py-4 px-2 border-b-2 transition-colors ${
                    activeSubTab === 'foods' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveSubTab('foods')}
                >
                  Lista de Alimentos
                </button>
                <button 
                  className={`py-4 px-2 border-b-2 transition-colors ${
                    activeSubTab === 'create' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveSubTab('create')}
                >
                  Criar Dieta
                </button>
                <button 
                  className={`py-4 px-2 border-b-2 transition-colors ${
                    activeSubTab === 'view' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveSubTab('view')}
                >
                  Ver Dietas
                </button>
              </div>
            </div>
            {activeSubTab === 'foods' && <NutritionManager />}
            {activeSubTab === 'create' && <DietCreator />}
            {activeSubTab === 'view' && <DietViewer />}
          </div>
        );
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