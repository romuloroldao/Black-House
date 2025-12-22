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
import { supabase } from "@/integrations/supabase/client";
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
  Menu,
  Link2
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({
    students: 0,
    messages: 0,
    payments: 0,
  });
  const [coachName, setCoachName] = useState<string>("");
  const [coachAvatar, setCoachAvatar] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
      loadCoachProfile();
      loadNotifications();

      // Subscribe to real-time updates
      const messagesChannel = supabase
        .channel('sidebar-messages-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mensagens' },
          () => loadNotifications()
        )
        .subscribe();

      const paymentsChannel = supabase
        .channel('sidebar-payments-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'asaas_payments' },
          () => loadNotifications()
        )
        .subscribe();

      const studentsChannel = supabase
        .channel('sidebar-students-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alunos' },
          () => loadNotifications()
        )
        .subscribe();

      // Presence channel for online status
      const presenceChannel = supabase.channel('coach-presence');
      
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          setIsOnline(true);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

      // Handle visibility change to update presence
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          await presenceChannel.untrack();
          setIsOnline(false);
        } else {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
          setIsOnline(true);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(paymentsChannel);
        supabase.removeChannel(studentsChannel);
        supabase.removeChannel(presenceChannel);
      };
    }
  }, [user]);

  const loadCoachProfile = async () => {
    if (!user) return;

    // Get user metadata
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const metadata = userData.user.user_metadata;
      const fullName = metadata?.full_name || metadata?.name || metadata?.display_name || user.email?.split('@')[0] || 'Coach';
      const firstName = fullName.split(' ')[0];
      setCoachName(firstName);
      
      // Try to get avatar from profiles table first
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userData.user.id)
        .single();
      
      setCoachAvatar(profile?.avatar_url || metadata?.avatar_url || null);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;

    const counts: Record<string, number> = {
      students: 0,
      messages: 0,
      payments: 0,
    };

    // Count new students (created in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: newStudents } = await supabase
      .from('alunos')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .gte('created_at', sevenDaysAgo.toISOString());
    counts.students = newStudents || 0;

    // Count unread messages in all conversations
    const { data: conversas } = await supabase
      .from('conversas')
      .select('id')
      .eq('coach_id', user.id);

    if (conversas) {
      const conversaIds = conversas.map(c => c.id);
      if (conversaIds.length > 0) {
        const { count: unreadMessages } = await supabase
          .from('mensagens')
          .select('*', { count: 'exact', head: true })
          .in('conversa_id', conversaIds)
          .eq('lida', false)
          .neq('remetente_id', user.id);
        counts.messages = unreadMessages || 0;
      }
    }

    // Count pending payments
    const { count: pendingPayments } = await supabase
      .from('asaas_payments')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .in('status', ['PENDING', 'OVERDUE']);
    counts.payments = pendingPayments || 0;

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
      navigate('/auth');
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
            {navigationItems.map((item) => (
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
            ))}
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
                {coachName.charAt(0).toUpperCase()}
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
    );
  }

  return (
    <div className="w-64 h-full bg-gradient-card border-r border-border flex flex-col shadow-elevated transition-all duration-300 ease-in-out">
      <SidebarContent />
    </div>
  );
};

export default Sidebar;