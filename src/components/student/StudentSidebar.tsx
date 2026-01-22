import { Home, Utensils, Dumbbell, Play, MessageSquare, TrendingUp, DollarSign, User, LogOut, FileText, Megaphone, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import logoWhite from "@/assets/logo-white.svg";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import MessagesPopover from "./MessagesPopover";

interface StudentSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const StudentSidebar = ({ activeTab, onTabChange }: StudentSidebarProps) => {
  const { signOut, user } = useAuth();
  const { isReady, identity } = useDataContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [animateBadge, setAnimateBadge] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadRef = useRef(0);
  const [studentName, setStudentName] = useState<string>("");
  const [studentAvatar, setStudentAvatar] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const isMarkingAsReadRef = useRef(false);

  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Componente só monta quando DataContext === READY
  if (!isReady) {
    return null;
  }

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
    
    // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Removido loadStudentProfile() - dados vêm do DataContext
    // Avatar e nome devem ser passados via props ou obtidos de getMe() quando necessário
    if (user) {
      // Carregar dados do aluno via getMe() apenas quando necessário (não em mount)
      loadUnreadCount();
      loadUnreadMessages();
      
      // DESIGN-SUPABASE-PURGE-MESSAGING-001: Polling só para alunos
      let intervalId: NodeJS.Timeout | null = null;
      
      if (user.role === 'aluno') {
        intervalId = setInterval(() => {
          if (!isMarkingAsReadRef.current) {
            loadUnreadCount();
            loadUnreadMessages();
          }
        }, 10000); // Atualizar a cada 10 segundos
      }

      // Handle visibility change
      const handleVisibilityChange = () => {
        setIsOnline(!document.hidden);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [user, toast]);

  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: loadStudentProfile() removido
  // Dados devem vir do DataContext ou ser carregados sob demanda (não em mount)
  // Avatar e nome podem ser obtidos via getMe() quando necessário, não automaticamente

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      // DESIGN-ALUNO-CANONICO-UNIFICADO-005: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();
      if (!aluno) return;

      // Get student's classes
      const turmasAluno = await apiClient
        .from("turmas_alunos")
        .select("turma_id")
        .eq("aluno_id", aluno.id);

      const turmaIds = Array.isArray(turmasAluno) ? turmasAluno.map(t => t.turma_id) : [];

      // Count unread individual messages
      const individualAvisos = await apiClient
        .from("avisos_destinatarios")
        .select("id")
        .eq("aluno_id", aluno.id)
        .eq("lido", false);
      const individualCount = Array.isArray(individualAvisos) ? individualAvisos.length : 0;

      // Count unread class messages
      let classCount = 0;
      if (turmaIds.length > 0) {
        // Buscar todos e filtrar por turma_id
        const allAvisos = await apiClient
          .from("avisos_destinatarios")
          .select("id, turma_id")
          .eq("lido", false);
        
        const classAvisos = Array.isArray(allAvisos)
          ? allAvisos.filter(a => turmaIds.includes(a.turma_id))
          : [];
        classCount = classAvisos.length;
      }

      setUnreadCount(individualCount + classCount);
    } catch (error) {
      console.error('Erro ao carregar contagem de avisos:', error);
    }
  };

  const loadUnreadMessages = async () => {
    // DESIGN-SUPABASE-PURGE-MESSAGING-001: Apenas alunos podem carregar mensagens
    if (!user || user.role !== 'aluno') {
      setUnreadMessages(0);
      return;
    }

    try {
      // DESIGN-SUPABASE-PURGE-MESSAGING-001: Usar rota semântica GET /api/mensagens
      const mensagensData = await apiClient.request('/api/mensagens');
      const mensagens = Array.isArray(mensagensData) ? mensagensData : [];
      
      // Filtrar mensagens não lidas do destinatário
      const mensagensNaoLidas = mensagens.filter(
        (m: any) => m.destinatario_id === user.id && !m.lida
      );

      const newCount = mensagensNaoLidas.length;
      
      // Check if count increased
      if (newCount > previousUnreadRef.current && previousUnreadRef.current > 0) {
        setAnimateBadge(true);
        setTimeout(() => setAnimateBadge(false), 1000);
      }
      
      previousUnreadRef.current = newCount;
      setUnreadMessages(newCount);
    } catch (error) {
      console.error('Erro ao carregar mensagens não lidas:', error);
    }
  };

  const markChatMessagesAsRead = async () => {
    // DESIGN-SUPABASE-PURGE-MESSAGING-001: Apenas alunos podem marcar mensagens como lidas
    if (!user || user.role !== 'aluno') return;

    // Clear badge immediately for better UX
    setUnreadMessages(0);

    try {
      // DESIGN-SUPABASE-PURGE-MESSAGING-001: Usar rota semântica GET /api/mensagens
      const mensagensData = await apiClient.request('/api/mensagens');
      const mensagens = Array.isArray(mensagensData) ? mensagensData : [];
      
      // Filtrar mensagens não lidas do destinatário
      const mensagensNaoLidas = mensagens.filter(
        (m: any) => m.destinatario_id === user.id && !m.lida
      );

      // Marcar cada uma como lida
      for (const msg of mensagensNaoLidas) {
        await apiClient.request(`/api/mensagens/${msg.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ lida: true }),
        });
      }
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };

  const markAnnouncementsAsRead = async () => {
    if (!user) return;

    // Set flag to prevent polling from reloading
    isMarkingAsReadRef.current = true;
    
    // Clear badge immediately for better UX
    setUnreadCount(0);

    try {
      // DESIGN-ALUNO-CANONICO-UNIFICADO-005: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();
      if (!aluno) {
        isMarkingAsReadRef.current = false;
        return;
      }

      const turmasAluno = await apiClient
        .from("turmas_alunos")
        .select("turma_id")
        .eq("aluno_id", aluno.id);

      const turmaIds = Array.isArray(turmasAluno) ? turmasAluno.map(t => t.turma_id) : [];

      // Mark individual messages as read
      const individualAvisos = await apiClient
        .from("avisos_destinatarios")
        .select("id")
        .eq("aluno_id", aluno.id)
        .eq("lido", false);

      if (Array.isArray(individualAvisos)) {
        for (const aviso of individualAvisos) {
          await apiClient
            .from("avisos_destinatarios")
            .update({ lido: true, lido_em: new Date().toISOString(), id: aviso.id });
        }
      }

      // Mark class messages as read
      if (turmaIds.length > 0) {
        const allAvisos = await apiClient
          .from("avisos_destinatarios")
          .select("id, turma_id")
          .eq("lido", false);
        
        const classAvisos = Array.isArray(allAvisos)
          ? allAvisos.filter(a => turmaIds.includes(a.turma_id))
          : [];

        for (const aviso of classAvisos) {
          await apiClient
            .from("avisos_destinatarios")
            .update({ lido: true, lido_em: new Date().toISOString(), id: aviso.id });
        }
      }

      // Wait a bit for database to propagate changes, then allow polling again
      setTimeout(() => {
        isMarkingAsReadRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Erro ao marcar avisos como lidos:', error);
      isMarkingAsReadRef.current = false;
    }
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    
    // Mark messages as read when user opens the respective tab
    if (tab === "chat" && unreadMessages > 0) {
      markChatMessagesAsRead();
    } else if (tab === "messages" && unreadCount > 0) {
      markAnnouncementsAsRead();
    }
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
    { id: "checkin", label: "Check-in Semanal", icon: ClipboardCheck },
    { id: "progress", label: "Meu Progresso", icon: TrendingUp },
    { id: "financial", label: "Financeiro", icon: DollarSign },
    { id: "profile", label: "Meu Perfil", icon: User },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <img src={logoWhite} alt="Black House" className="h-12 w-auto" />
        <MessagesPopover unreadCount={unreadMessages} onCountChange={setUnreadMessages} />
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
                      onClick={() => handleTabChange(item.id)}
                    >
                      <Icon className="mr-3 h-4 w-4" />
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
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
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={studentAvatar || undefined} alt={studentName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {studentName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div 
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background transition-colors",
                isOnline ? "bg-green-500" : "bg-muted-foreground"
              )}
              title={isOnline ? "Online" : "Offline"}
            />
          </div>
          <span className="text-sm font-medium text-foreground">{studentName}</span>
        </div>

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
