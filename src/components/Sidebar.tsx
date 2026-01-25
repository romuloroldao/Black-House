import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { RouterSafeComponent } from "./RouterSafeComponent";
import logoWhite from "@/assets/logo-white.svg";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  UtensilsCrossed,
  MessageSquare,
  BarChart3,
  Settings,
  Calendar,
  Video,
  LogOut,
  CreditCard,
  TrendingDown,
  AlertCircle,
  Wallet,
  FileText,
  UsersRound,
  Megaphone,
  Menu,
  Link2
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Sidebar deve renderizar mesmo com user null
// REACT-RENDER-CRASH-FIX-002: useNavigate() só é usado em handlers, não influencia render
const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { signOut, user } = useAuth();
  // REACT-RENDER-CRASH-FIX-002: useNavigate() pode existir, mas só é usado em handlers (não no render)
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({
    students: 0,
    messages: 0,
    payments: 0,
  });
  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Valores padrão seguros
  const [coachName, setCoachName] = useState<string>("Coach");
  const [coachAvatar, setCoachAvatar] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Verificar user de forma defensiva
    // DESIGN-ROLE-MESSAGING-ISOLATION-001: Coaches NÃO devem fazer polling de notificações
    // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Envolver chamadas async em try/catch
    if (user && user.role === 'coach') {
      // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros de loadCoachProfile
      loadCoachProfile().catch((error) => {
        console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar perfil do coach (não crítico):', error);
        // Não quebrar renderização - apenas logar warning
      });
      // DESIGN-E2E-CHECKLIST-ROLE-004: Coaches não têm endpoint de notificações ainda
      // loadNotifications(); // Removido: Coaches não fazem polling de notificações

      // Handle visibility change
      const handleVisibilityChange = () => {
        setIsOnline(!document.hidden);
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        // clearInterval(intervalId); // Removido: Não há polling para limpar
      };
    } else {
      // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Limpar estados se não for coach ou user null
      setCoachName('Coach');
      setCoachAvatar(null);
      setNotificationCounts({ students: 0, messages: 0, payments: 0 });
    }
  }, [user]);

  const loadCoachProfile = async () => {
    // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Verificação defensiva de user
    if (!user || !user.id) {
      setCoachName('Coach');
      setCoachAvatar(null);
      return;
    }

    // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Get user name from email or use default
    // Proteção contra email undefined ou null
    const email = user.email || '';
    const fullName = email.split('@')[0] || 'Coach';
    const firstName = fullName.split(' ')[0] || 'Coach';
    setCoachName(firstName || 'Coach');
    
    // REACT-API-RESILIENCE-FIX-008: Avatar será implementado via rota semântica futura
    // Por enquanto, não carregar avatar (fallback para iniciais)
    setCoachAvatar(null);
  };

  const loadNotifications = async () => {
    if (!user) return;

    // REACT-API-RESILIENCE-FIX-008: Notificações via rotas semânticas (futuro)
    // Por enquanto, usar valores padrão
    const counts: Record<string, number> = {
      students: 0,
      messages: 0,
      payments: 0,
    };

    setNotificationCounts(counts);
  };

  const clearNotifications = (tabId: string) => {
    setNotificationCounts(prev => ({
      ...prev,
      [tabId]: 0,
    }));
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      // REACT-RENDER-CRASH-FIX-002: navigate() usado apenas em handler - pode falhar sem quebrar render
      try {
        if (navigate && typeof navigate === 'function') {
          navigate('/auth');
        } else {
          // Fallback: redirecionar via window.location se navigate não estiver disponível
          window.location.href = '/auth';
        }
      } catch (navError) {
        // REACT-RENDER-CRASH-FIX-002: Se navigate falhar, usar window.location como fallback
        console.warn('[REACT-RENDER-CRASH-FIX-002] Erro ao navegar (não crítico). Usando window.location:', navError);
        window.location.href = '/auth';
      }
    } catch (error) {
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const getNotificationCount = (itemId: string) => {
    return notificationCounts[itemId] || 0;
  };

  const navigationItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "students",
      label: "Alunos",
      icon: Users,
    },
    {
      id: "workouts",
      label: "Treinos",
      icon: Dumbbell,
    },
    {
      id: "videos",
      label: "Galeria de Vídeos",
      icon: Video,
    },
    {
      id: "nutrition",
      label: "Nutrição",
      icon: UtensilsCrossed,
    },
    {
      id: "messages",
      label: "Mensagens",
      icon: MessageSquare,
    },
    {
      id: "payment-plans",
      label: "Planos de Pagamento",
      icon: Wallet,
    },
    {
      id: "payments-tracker",
      label: "Acompanhar Pagamentos",
      icon: CreditCard,
    },
    {
      id: "exceptions",
      label: "Exceções",
      icon: AlertCircle,
    },
    {
      id: "expenses",
      label: "Despesas",
      icon: TrendingDown,
    },
    {
      id: "financial-dashboard",
      label: "Dashboard Financeiro",
      icon: BarChart3,
    },
    {
      id: "calendar",
      label: "Agenda",
      icon: Calendar,
    },
    {
      id: "reports",
      label: "Relatórios de Progresso",
      icon: FileText,
      notifications: 0
    },
    {
      id: "classes",
      label: "Turmas",
      icon: UsersRound,
    },
    {
      id: "announcements",
      label: "Avisos em Massa",
      icon: Megaphone,
    },
    {
      id: "user-linking",
      label: "Vincular Usuários",
      icon: Link2,
    }
  ];

  const bottomItems = [
    {
      id: "settings",
      label: "Configurações",
      icon: Settings,
    },
    {
      id: "logout",
      label: "Sair",
      icon: LogOut,
    }
  ];

  const handleTabChange = (tab: string) => {
    // Clear notifications for this tab
    if (notificationCounts[tab] > 0) {
      clearNotifications(tab);
    }
    
    onTabChange(tab);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="h-full bg-gradient-card flex flex-col transition-all duration-300 ease-in-out">
      {/* Logo */}
      <div className="p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-full flex flex-col items-center">
            <img 
              src={logoWhite} 
              alt="Black House" 
              className="w-full h-auto max-w-[180px] mb-2"
            />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              saúde integrativa & performance
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-2">
          <TooltipProvider delayDuration={0}>
            {/* DESIGN-ROOT-RENDER-UNBLOCK-001: Validar navigationItems antes de .map() */}
            {Array.isArray(navigationItems) && navigationItems.length > 0 ? navigationItems.map((item) => {
              // DESIGN-ROOT-RENDER-UNBLOCK-001: Validar item antes de renderizar
              if (!item || !item.id) {
                return null;
              }
              return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === item.id ? "premium" : "ghost"}
                    className={cn(
                      "w-full justify-start text-left font-medium transition-all duration-300 ease-in-out",
                      activeTab === item.id 
                        ? "bg-gradient-primary text-primary-foreground shadow-glow scale-105" 
                        : "hover:bg-muted/50 hover:scale-102"
                    )}
                    onClick={() => handleTabChange(item.id)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {getNotificationCount(item.id) > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="h-5 w-5 p-0 flex items-center justify-center text-xs animate-in fade-in duration-300"
                      >
                        {getNotificationCount(item.id)}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:hidden">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
              );
            }).filter(Boolean) : null}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Coach Profile */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={coachAvatar || undefined} alt={coachName} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {/* DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Proteção contra string vazia */}
                {(coachName && coachName.length > 0) ? coachName.charAt(0).toUpperCase() : 'C'}
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
          <span className="text-sm font-medium text-foreground">{coachName}</span>
        </div>

        {/* Bottom Navigation */}
        <div className="space-y-1">
          {/* DESIGN-ROOT-RENDER-UNBLOCK-001: Validar bottomItems antes de .map() */}
          {Array.isArray(bottomItems) && bottomItems.length > 0 ? bottomItems.map((item) => {
            // DESIGN-ROOT-RENDER-UNBLOCK-001: Validar item antes de renderizar
            if (!item || !item.id) {
              return null;
            }
            if (item.id === 'logout') {
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="w-full justify-start text-left text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Button>
              );
            }
            return (
              <Button
                key={item.id}
                variant="ghost"
                className="w-full justify-start text-left"
                onClick={() => handleTabChange(item.id)}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            );
          }).filter(Boolean) : null}
        </div>
      </div>
    </div>
  );

  // REACT-RENDER-CRASH-FIX-002: Envolver com RouterSafeComponent para garantir Router disponível
  // (useNavigate() requer Router, mesmo que só seja usado em handlers)
  return (
    <RouterSafeComponent
      fallback={
        <div className="w-64 h-full bg-gradient-card border-r border-border flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      {isMobile ? (
        <>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 md:hidden transition-transform hover:scale-110 duration-200"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 transition-all duration-300 ease-in-out">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <div className="w-64 h-full bg-gradient-card border-r border-border flex flex-col shadow-elevated transition-all duration-300 ease-in-out">
          <SidebarContent />
        </div>
      )}
    </RouterSafeComponent>
  );
};

export default Sidebar;