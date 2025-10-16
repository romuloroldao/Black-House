import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import DietCreator from "@/components/DietCreator";
import { useState } from "react";

export default function DietaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("nutrition");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Navegar para a rota correspondente
    switch(tab) {
      case 'dashboard':
        navigate('/');
        break;
      case 'alunos':
        navigate('/');
        break;
      case 'treinos':
        navigate('/');
        break;
      case 'videos':
        navigate('/');
        break;
      case 'nutrition':
        // Já está na página de nutrição
        break;
      case 'mensagens':
        navigate('/');
        break;
      case 'pagamentos':
        navigate('/');
        break;
      case 'agenda':
        navigate('/');
        break;
      case 'lives':
        navigate('/');
        break;
      case 'relatorios':
        navigate('/');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 overflow-auto">
        <DietCreator dietaId={id} />
      </main>
    </div>
  );
}
