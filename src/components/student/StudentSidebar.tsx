import { Home, Utensils, Dumbbell, Play, MessageSquare, TrendingUp, DollarSign, User, LogOut, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoWhite from "@/assets/logo-white.svg";
import { useToast } from "@/hooks/use-toast";

interface StudentSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const StudentSidebar = ({ activeTab, onTabChange }: StudentSidebarProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [animateBadge, setAnimateBadge] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadRef = useRef(0);

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    
    if (user) {
      loadUnreadCount();
      loadUnreadMessages();
      
      // Subscribe to avisos changes
      const avisosChannel = supabase
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

      // Subscribe to mensagens changes for chat
      const mensagensChannel = supabase
        .channel('mensagens-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensagens'
          },
          async (payload) => {
            // Check if message is for current user
            const { data: alunoData } = await supabase
              .from("alunos")
              .select("id")
              .eq("email", user.email)
              .single();

            if (alunoData) {
              const { data: conversaData } = await supabase
                .from("conversas")
                .select("id")
                .eq("aluno_id", alunoData.id)
                .single();

              if (conversaData && payload.new.conversa_id === conversaData.id && payload.new.remetente_id !== user.id) {
                // New message received
                loadUnreadMessages();
                
                // Play notification sound
                if (audioRef.current) {
                  audioRef.current.play().catch(e => console.log('Audio play failed:', e));
                }
                
                // Trigger badge animation
                setAnimateBadge(true);
                setTimeout(() => setAnimateBadge(false), 1000);
                
                // Show toast notification
                toast({
                  title: "Nova mensagem",
                  description: "Você recebeu uma nova mensagem no chat",
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(avisosChannel);
        supabase.removeChannel(mensagensChannel);
      };
    }
  }, [user, toast]);

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

  const loadUnreadMessages = async () => {
    if (!user) return;

    const { data: alunoData } = await supabase
      .from("alunos")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!alunoData) return;

    const { data: conversaData } = await supabase
      .from("conversas")
      .select("id")
      .eq("aluno_id", alunoData.id)
      .single();

    if (!conversaData) return;

    const { count } = await supabase
      .from("mensagens")
      .select("*", { count: "exact", head: true })
      .eq("conversa_id", conversaData.id)
      .eq("lida", false)
      .neq("remetente_id", user.id);

    const newCount = count || 0;
    
    // Check if count increased
    if (newCount > previousUnreadRef.current && previousUnreadRef.current > 0) {
      setAnimateBadge(true);
      setTimeout(() => setAnimateBadge(false), 1000);
    }
    
    previousUnreadRef.current = newCount;
    setUnreadMessages(newCount);
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
    { id: "chat", label: "Chat", icon: MessageSquare, badge: unreadMessages },
    { id: "messages", label: "Mensagens do Coach", icon: Megaphone, badge: unreadCount },
    { id: "reports", label: "Meus Relatórios", icon: FileText },
    { id: "progress", label: "Meu Progresso", icon: TrendingUp },
    { id: "financial", label: "Financeiro", icon: DollarSign },
    { id: "profile", label: "Meu Perfil", icon: User },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out">
      <div className="p-6 border-b border-border">
        <img src={logoWhite} alt="Black House" className="h-12 w-auto" />
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-2">
          <TooltipProvider delayDuration={0}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className="w-full justify-start relative transition-all duration-200 ease-in-out"
                      onClick={() => onTabChange(item.id)}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {item.label}
                      {item.badge && item.badge > 0 && (
                        <Badge 
                          variant="destructive" 
                          className={`ml-auto ${animateBadge && item.id === 'chat' ? 'animate-bounce' : ''}`}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:hidden">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
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
