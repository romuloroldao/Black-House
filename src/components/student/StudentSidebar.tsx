import { Home, Utensils, Dumbbell, Play, MessageSquare, TrendingUp, DollarSign, User, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import logoWhite from "@/assets/logo-white.svg";

interface StudentSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const StudentSidebar = ({ activeTab, onTabChange }: StudentSidebarProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "diet", label: "Minha Dieta", icon: Utensils },
    { id: "workouts", label: "Meus Treinos", icon: Dumbbell },
    { id: "videos", label: "Galeria de Vídeos", icon: Play },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "reports", label: "Meus Relatórios", icon: FileText },
    { id: "progress", label: "Meu Progresso", icon: TrendingUp },
    { id: "financial", label: "Financeiro", icon: DollarSign },
    { id: "profile", label: "Meu Perfil", icon: User },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <img src={logoWhite} alt="Black House" className="h-12 w-auto" />
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default StudentSidebar;
