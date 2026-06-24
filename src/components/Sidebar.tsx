import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { RouterSafeComponent } from "./RouterSafeComponent";
import {
  FINANCIAL_PATHS,
  FINANCIAL_TAB_IDS,
} from "@/lib/financial-routes";
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
  Wallet,
  FileText,
  UsersRound,
  Megaphone,
  Menu,
  Link2,
  ListChecks,
  BookOpen,
  ChevronDown,
  Landmark,
  UserCircle,
  LineChart,
  Plug,
  SlidersHorizontal,
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
    "check-ins": 0,
  });
  // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Valores padrão seguros
  const [coachName, setCoachName] = useState<string>("Coach");
  const [coachAvatar, setCoachAvatar] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [financialOpen, setFinancialOpen] = useState(false);

  const getCoachFirstName = (email?: string | null) => {
    const rawEmail = (email || "").trim().toLowerCase();
    if (!rawEmail.includes("@")) return "Coach";

    const localPart = rawEmail.split("@")[0] || "";
    const normalized = localPart.replace(/[._-]+/g, " ").trim();
    const firstChunk = normalized.split(" ").filter(Boolean)[0];

    if (!firstChunk) return "Coach";
    return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1);
  };

  const normalizeAvatarUrl = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    if (!value) return null;
    if (value.startsWith("/api/")) {
      const base = (import.meta.env.VITE_API_URL || "https://api.blackhouse.app.br").replace(/\/$/, "");
      return `${base}${value}`;
    }
    if (/^http:\/\/localhost:3001/i.test(value)) {
      return value.replace(/^http:\/\/localhost:3001/i, "https://api.blackhouse.app.br");
    }
    return value;
  };

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
    if (user && (user.role === 'coach' || user.role === 'admin')) {
      // DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001: Capturar erros de loadCoachProfile
      loadCoachProfile().catch((error) => {
        console.warn('[DESIGN-CHECKPOINT-ASYNC-ERROR-SAFETY-001] Erro ao carregar perfil do coach (não crítico):', error);
        // Não quebrar renderização - apenas logar warning
      });
      loadCheckinPendingCount().catch(() => {});
      const intervalId = window.setInterval(() => {
        loadCheckinPendingCount().catch(() => {});
      }, 60_000);

      const handleVisibilityChange = () => {
        setIsOnline(!document.hidden);
        if (!document.hidden) {
          loadCheckinPendingCount().catch(() => {});
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      const onCheckinPendingUpdated = () => {
        loadCheckinPendingCount().catch(() => {});
      };
      window.addEventListener('blackhouse:checkin-pending-updated', onCheckinPendingUpdated);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blackhouse:checkin-pending-updated', onCheckinPendingUpdated);
        clearInterval(intervalId);
      };
    } else {
      // DESIGN-CHECKPOINT-ROOT-RENDER-FAILURE-001: Limpar estados se não for coach ou user null
      setCoachName('Coach');
      setCoachAvatar(null);
      setNotificationCounts({ students: 0, messages: 0, payments: 0, "check-ins": 0 });
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
    setCoachName(getCoachFirstName(user.email));
    
    const profileResult = await apiClient.requestSafe<any>('/api/profiles/me');
    if (profileResult.success) {
      const displayName = String(profileResult.data?.display_name || '').trim();
      if (displayName) {
        const first = displayName.split(/\s+/).filter(Boolean)[0];
        if (first) {
          setCoachName(first.charAt(0).toUpperCase() + first.slice(1));
        }
      }
      setCoachAvatar(normalizeAvatarUrl(profileResult.data?.avatar_url));
    } else {
      setCoachAvatar(null);
    }
  };

  const loadCheckinPendingCount = async () => {
    if (!user || (user.role !== "coach" && user.role !== "admin")) return;

    const result = await apiClient.requestSafe<{ count?: number }>(
      "/api/weekly-checkins/pendentes/count",
    );
    if (result.success) {
      setNotificationCounts((prev) => ({
        ...prev,
        "check-ins": result.data?.count ?? 0,
      }));
    }
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

  const financialNavItems = [
    { id: FINANCIAL_TAB_IDS.overview, label: "Visão Geral", icon: BarChart3, path: FINANCIAL_PATHS.overview },
    { id: FINANCIAL_TAB_IDS.charges, label: "Cobranças", icon: CreditCard, path: FINANCIAL_PATHS.charges },
    { id: FINANCIAL_TAB_IDS.subscriptions, label: "Assinaturas", icon: Users, path: FINANCIAL_PATHS.subscriptions },
    { id: FINANCIAL_TAB_IDS.plans, label: "Planos", icon: Wallet, path: FINANCIAL_PATHS.plans },
    { id: FINANCIAL_TAB_IDS.clients, label: "Clientes", icon: UserCircle, path: FINANCIAL_PATHS.clients },
    { id: FINANCIAL_TAB_IDS.expenses, label: "Despesas", icon: TrendingDown, path: FINANCIAL_PATHS.expenses },
    { id: FINANCIAL_TAB_IDS.cashFlow, label: "Fluxo de Caixa", icon: LineChart, path: FINANCIAL_PATHS.cashFlow },
    { id: FINANCIAL_TAB_IDS.reports, label: "Relatórios", icon: FileText, path: FINANCIAL_PATHS.reports },
    { id: FINANCIAL_TAB_IDS.integration, label: "Integração Asaas", icon: Plug, path: FINANCIAL_PATHS.integration },
    { id: FINANCIAL_TAB_IDS.settings, label: "Configurações", icon: SlidersHorizontal, path: FINANCIAL_PATHS.settings },
  ];

  const isFinancialActive = financialNavItems.some((item) => item.id === activeTab) || activeTab === "financeiro";

  useEffect(() => {
    if (isFinancialActive) {
      setFinancialOpen(true);
    }
  }, [isFinancialActive]);

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
      id: "educational-contents",
      label: "Conteúdos Educativos",
      icon: BookOpen,
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
      id: "check-ins",
      label: "Check-ins",
      icon: ListChecks,
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

  const handleFinancialNavigate = (path: string, tabId: string) => {
    if (notificationCounts[tabId] > 0) {
      clearNotifications(tabId);
    }
    navigate(path);
    onTabChange(tabId);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

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

  const handleMainNav = (tab: string) => {
    if (notificationCounts[tab] > 0) {
      clearNotifications(tab);
    }
    navigate("/");
    onTabChange(tab);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="h-full bg-gradient-card flex flex-col transition-all duration-300 ease-in-out motion-reduce:transition-none">
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
              if (!item || !item.id) {
                return null;
              }
              const insertFinancialAfter = item.id === "check-ins";
              return (
              <div key={item.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === item.id ? "premium" : "ghost"}
                    className={cn(
                      "w-full justify-start text-left font-medium transition-all duration-300 ease-in-out motion-reduce:transition-none",
                      activeTab === item.id 
                        ? "bg-gradient-primary text-primary-foreground shadow-glow motion-safe:scale-[1.02]" 
                        : "hover:bg-muted/50 motion-safe:hover:scale-[1.01]"
                    )}
                    onClick={() => handleMainNav(item.id)}
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
              {insertFinancialAfter && (
                <Collapsible open={financialOpen} onOpenChange={setFinancialOpen} className="mt-1">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant={isFinancialActive ? "premium" : "ghost"}
                      className={cn(
                        "w-full justify-start text-left font-medium",
                        isFinancialActive && "bg-gradient-primary/80 text-primary-foreground",
                      )}
                    >
                      <Landmark className="w-5 h-5" />
                      <span className="flex-1">Financeiro</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", financialOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-3 mt-1 space-y-1 border-l border-border ml-4">
                    {financialNavItems.map((fItem) => (
                      <Button
                        key={fItem.id}
                        variant={activeTab === fItem.id ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left text-sm",
                          activeTab === fItem.id && "bg-muted font-medium",
                        )}
                        onClick={() => handleFinancialNavigate(fItem.path, fItem.id)}
                      >
                        <fItem.icon className="w-4 h-4 mr-2 shrink-0" />
                        {fItem.label}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
              </div>
              );
            }).filter(Boolean) : null}
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {/* Coach Profile */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-muted/50 transition-colors motion-reduce:transition-none">
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
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full motion-safe:animate-spin" />
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
                className="fixed top-4 left-4 z-50 md:hidden transition-transform duration-200 motion-safe:hover:scale-110 motion-reduce:transition-none"
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 transition-all duration-300 ease-in-out motion-reduce:transition-none">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <div className="w-64 h-full bg-gradient-card border-r border-border flex flex-col shadow-elevated transition-all duration-300 ease-in-out motion-reduce:transition-none">
          <SidebarContent />
        </div>
      )}
    </RouterSafeComponent>
  );
};

export default Sidebar;