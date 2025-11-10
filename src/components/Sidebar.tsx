import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import logoWhite from "@/assets/logo-white.svg";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  UtensilsCrossed,
  MessageSquare,
  DollarSign,
  BarChart3,
  Settings,
  Calendar,
  Video,
  Bell,
  Star,
  LogOut,
  CreditCard,
  TrendingDown,
  AlertCircle,
  Wallet,
  RefreshCw,
  FileText,
  UsersRound,
  Megaphone,
  CalendarDays,
  Menu
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const navigationItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      notifications: 0
    },
    {
      id: "students",
      label: "Alunos",
      icon: Users,
      notifications: 3
    },
    {
      id: "workouts",
      label: "Treinos",
      icon: Dumbbell,
      notifications: 0
    },
    {
      id: "videos",
      label: "Galeria de Vídeos",
      icon: Video,
      notifications: 0
    },
    {
      id: "nutrition",
      label: "Nutrição",
      icon: UtensilsCrossed,
      notifications: 0
    },
    {
      id: "messages",
      label: "Mensagens",
      icon: MessageSquare,
      notifications: 8
    },
    {
      id: "payment-plans",
      label: "Planos de Pagamento",
      icon: Wallet,
      notifications: 0
    },
    {
      id: "payments",
      label: "Pagamentos",
      icon: DollarSign,
      notifications: 2
    },
    {
      id: "recurring-charges",
      label: "Cobranças Recorrentes",
      icon: RefreshCw,
      notifications: 0
    },
    {
      id: "exceptions",
      label: "Exceções",
      icon: AlertCircle,
      notifications: 0
    },
    {
      id: "expenses",
      label: "Despesas",
      icon: TrendingDown,
      notifications: 0
    },
    {
      id: "financial-dashboard",
      label: "Dashboard Financeiro",
      icon: BarChart3,
      notifications: 0
    },
    {
      id: "calendar",
      label: "Agenda",
      icon: Calendar,
      notifications: 0
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
      notifications: 0
    },
    {
      id: "announcements",
      label: "Avisos em Massa",
      icon: Megaphone,
      notifications: 0
    },
    {
      id: "events",
      label: "Eventos",
      icon: CalendarDays,
      notifications: 0
    },
    {
      id: "analytics",
      label: "Análises",
      icon: Star,
      notifications: 0
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
    onTabChange(tab);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="h-full bg-gradient-card flex flex-col">
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
          {navigationItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "premium" : "ghost"}
              className={cn(
                "w-full justify-start text-left font-medium transition-smooth",
                activeTab === item.id 
                  ? "bg-gradient-primary text-primary-foreground shadow-glow" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => handleTabChange(item.id)}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.notifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {item.notifications}
                </Badge>
              )}
            </Button>
          ))}
        </nav>
      </ScrollArea>

      {/* Premium Badge */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="bg-gradient-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Plano Premium</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Você tem acesso a todas as funcionalidades!
          </p>
          <Button variant="outline" size="sm" className="w-full">
            Gerenciar Plano
          </Button>
        </div>

        {/* Bottom Navigation */}
        <div className="space-y-1">
          {bottomItems.map((item) => {
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
          })}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-50 md:hidden"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="w-64 h-full bg-gradient-card border-r border-border flex flex-col shadow-elevated">
      <SidebarContent />
    </div>
  );
};

export default Sidebar;