import { useState } from "react";
import {
  Home,
  Dumbbell,
  Utensils,
  TrendingUp,
  MoreHorizontal,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Megaphone,
  Play,
  DollarSign,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface StudentBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadMessages?: number;
  unreadAnnouncements?: number;
}

const PRIMARY_TABS = [
  { id: "dashboard", label: "Hoje", icon: Home },
  { id: "workouts", label: "Treino", icon: Dumbbell },
  { id: "diet", label: "Dieta", icon: Utensils },
  { id: "progress", label: "Progresso", icon: TrendingUp },
] as const;

const MORE_ITEMS = [
  { id: "checkin", label: "Check-in Semanal", icon: ClipboardCheck },
  { id: "reports", label: "Meus Relatórios", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare, badgeKey: "messages" as const },
  {
    id: "messages",
    label: "Mensagens do Coach",
    icon: Megaphone,
    badgeKey: "announcements" as const,
  },
  { id: "videos", label: "Galeria de Vídeos", icon: Play },
  { id: "financial", label: "Financeiro", icon: DollarSign },
  { id: "profile", label: "Meu Perfil", icon: User },
];

const MORE_TAB_IDS = new Set(MORE_ITEMS.map((i) => i.id));

const StudentBottomNav = ({
  activeTab,
  onTabChange,
  unreadMessages = 0,
  unreadAnnouncements = 0,
}: StudentBottomNavProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const moreActive = MORE_TAB_IDS.has(activeTab);
  const moreBadge = unreadMessages + unreadAnnouncements;

  const handlePrimary = (tab: string) => {
    setMoreOpen(false);
    onTabChange(tab);
  };

  const handleMoreItem = (tab: string) => {
    setMoreOpen(false);
    onTabChange(tab);
  };

  const handleLogout = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/auth");
  };

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5 h-16">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePrimary(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] font-medium transition-colors",
              moreActive || moreOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span>Mais</span>
            {moreBadge > 0 && (
              <Badge
                variant="destructive"
                className="absolute top-1 right-2 h-4 min-w-4 px-1 text-[10px]"
              >
                {moreBadge > 9 ? "9+" : moreBadge}
              </Badge>
            )}
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>Mais opções</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 pb-6">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badge =
                item.badgeKey === "messages"
                  ? unreadMessages
                  : item.badgeKey === "announcements"
                    ? unreadAnnouncements
                    : 0;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start h-12 text-base"
                  onClick={() => handleMoreItem(item.id)}
                >
                  <Icon className="mr-3 h-5 w-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge > 0 && (
                    <Badge variant="destructive">{badge > 9 ? "9+" : badge}</Badge>
                  )}
                </Button>
              );
            })}
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base mt-4"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default StudentBottomNav;
