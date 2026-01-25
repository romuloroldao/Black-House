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

  // DESIGN-023-RUNTIME-CRASH-RESOLUTION-001: Guard defensivo - componente NÃO renderiza fora de READY
  // DESIGN-FRONTEND-HERMETIC-BOOTSTRAP-AND-ASSET-FIX-021: Componente só monta quando DataContext === READY
  if (!isReady) {
    return null;
  }

  // DESIGN-023: Guards defensivos para dados do aluno
  const safeStudentName = studentName || user?.email || 'Usuário';
  const safeStudentAvatar = studentAvatar || null;
  const safeInitial = safeStudentName.charAt(0)?.toUpperCase() || '?';

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

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;
    if (!aluno) return;

    const turmasResult = await apiClient.requestSafe<any[]>('/api/turmas-alunos');
    const turmasAluno = turmasResult.success && Array.isArray(turmasResult.data) ? turmasResult.data : [];
    const turmaIds = turmasAluno.filter(t => t.aluno_id === aluno.id).map(t => t.turma_id);

    const avisosResult = await apiClient.requestSafe<any[]>('/api/avisos-destinatarios');
    const avisos = avisosResult.success && Array.isArray(avisosResult.data) ? avisosResult.data : [];

    const individualCount = avisos.filter(a => a.aluno_id === aluno.id && a.lido === false).length;
    const classCount = turmaIds.length > 0
      ? avisos.filter(a => a.lido === false && turmaIds.includes(a.turma_id)).length
      : 0;

    setUnreadCount(individualCount + classCount);
  };

  const loadUnreadMessages = async () => {
    // DESIGN-SUPABASE-PURGE-MESSAGING-001: Apenas alunos podem carregar mensagens
    if (!user || user.role !== 'aluno') {
      setUnreadMessages(0);
      return;
    }

    const mensagensResult = await apiClient.requestSafe<any[]>('/api/mensagens');
    const mensagens = mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];
    
    const mensagensNaoLidas = mensagens.filter(
      (m: any) => m.destinatario_id === user.id && !m.lida
    );

    const newCount = mensagensNaoLidas.length;
    
    if (newCount > previousUnreadRef.current && previousUnreadRef.current > 0) {
      setAnimateBadge(true);
      setTimeout(() => setAnimateBadge(false), 1000);
    }
    
    previousUnreadRef.current = newCount;
    setUnreadMessages(newCount);
  };

  const markChatMessagesAsRead = async () => {
    // DESIGN-SUPABASE-PURGE-MESSAGING-001: Apenas alunos podem marcar mensagens como lidas
    if (!user || user.role !== 'aluno') return;

    // Clear badge immediately for better UX
    setUnreadMessages(0);

    const mensagensResult = await apiClient.requestSafe<any[]>('/api/mensagens');
    const mensagens = mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];
    
    const mensagensNaoLidas = mensagens.filter(
      (m: any) => m.destinatario_id === user.id && !m.lida
    );

    for (const msg of mensagensNaoLidas) {
      await apiClient.requestSafe(`/api/mensagens/${msg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lida: true }),
      });
    }
  };

  const markAnnouncementsAsRead = async () => {
    if (!user) return;

    // Set flag to prevent polling from reloading
    isMarkingAsReadRef.current = true;
    
    // Clear badge immediately for better UX
    setUnreadCount(0);

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;
    if (!aluno) {
      isMarkingAsReadRef.current = false;
      return;
    }

    const turmasResult = await apiClient.requestSafe<any[]>('/api/turmas-alunos');
    const turmasAluno = turmasResult.success && Array.isArray(turmasResult.data) ? turmasResult.data : [];
    const turmaIds = turmasAluno.filter(t => t.aluno_id === aluno.id).map(t => t.turma_id);

    const avisosResult = await apiClient.requestSafe<any[]>('/api/avisos-destinatarios');
    const avisos = avisosResult.success && Array.isArray(avisosResult.data) ? avisosResult.data : [];

    const individualAvisos = avisos.filter(a => a.aluno_id === aluno.id && a.lido === false);
    for (const aviso of individualAvisos) {
      await apiClient.requestSafe(`/api/avisos-destinatarios/${aviso.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lido: true, lido_em: new Date().toISOString() })
      });
    }

    if (turmaIds.length > 0) {
      const classAvisos = avisos.filter(a => a.lido === false && turmaIds.includes(a.turma_id));
      for (const aviso of classAvisos) {
        await apiClient.requestSafe(`/api/avisos-destinatarios/${aviso.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ lido: true, lido_em: new Date().toISOString() })
        });
      }
    }

    setTimeout(() => {
      isMarkingAsReadRef.current = false;
    }, 500);
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
            {/* DESIGN-023: Guard defensivo - verificar array antes de .map */}
            {Array.isArray(menuItems) && menuItems.length > 0 ? (
              menuItems.map((item) => {
                // DESIGN-023: Optional chaining para acessos profundos
                const Icon = item?.icon;
                const itemId = item?.id || '';
                const itemLabel = item?.label || '';
                const itemBadge = typeof item?.badge === 'number' ? item.badge : undefined;
                const isActive = activeTab === itemId;
                
                if (!Icon) {
                  console.warn('[DESIGN-023] Item de menu sem ícone:', item);
                  return null;
                }

                return (
                  <Tooltip key={itemId}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        className="w-full justify-start relative transition-all duration-200 ease-in-out"
                        onClick={() => handleTabChange(itemId)}
                      >
                        <Icon className="mr-3 h-4 w-4" />
                        {itemLabel}
                        {itemBadge !== undefined && itemBadge > 0 && (
                          <Badge 
                            variant="destructive" 
                            className={`ml-auto ${animateBadge && itemId === 'chat' ? 'animate-bounce' : ''}`}
                          >
                            {itemBadge}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="md:hidden">
                      <p>{itemLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })
            ) : null}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="relative">
            <Avatar className="h-10 w-10">
              {/* DESIGN-023: Optional chaining para acessos profundos */}
              <AvatarImage src={safeStudentAvatar || undefined} alt={safeStudentName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {safeInitial}
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
          <span className="text-sm font-medium text-foreground">{safeStudentName}</span>
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
