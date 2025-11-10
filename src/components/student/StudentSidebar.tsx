import { Home, Utensils, Dumbbell, Play, MessageSquare, TrendingUp, DollarSign, User, LogOut, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/logo-white.svg";

interface StudentSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const StudentSidebar = ({ activeTab, onTabChange }: StudentSidebarProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      
      // Subscribe to real-time changes
      const channel = supabase
        .channel('avisos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'avisos_destinatarios'
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;

    // Get student ID
    const { data: alunoData } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!alunoData) return;

    // Get student's classes
    const { data: turmasAluno } = await supabase
      .from("turmas_alunos")
      .select("turma_id")
      .eq("aluno_id", alunoData.id);

    const turmaIds = turmasAluno?.map(t => t.turma_id) || [];

    // Count unread individual messages
    const { count: individualCount } = await supabase
      .from("avisos_destinatarios")
      .select("*", { count: "exact", head: true })
      .eq("aluno_id", alunoData.id)
      .eq("lido", false);

    // Count unread class messages
    let classCount = 0;
    if (turmaIds.length > 0) {
      const { count } = await supabase
        .from("avisos_destinatarios")
        .select("*", { count: "exact", head: true })
        .in("turma_id", turmaIds)
        .eq("lido", false);
      classCount = count || 0;
    }

    setUnreadCount((individualCount || 0) + classCount);
  };

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
    { id: "messages", label: "Mensagens do Coach", icon: Megaphone, badge: unreadCount },
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

      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className="w-full justify-start relative"
                onClick={() => onTabChange(item.id)}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.label}
                {item.badge && item.badge > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

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
