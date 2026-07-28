import {
  CalendarDays,
  Utensils,
  Dumbbell,
  Play,
  MessageSquare,
  Camera,
  DollarSign,
  User,
  LogOut,
  FileText,
  ClipboardCheck,
  ChevronDown,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import logoWhite from "@/assets/logo-white.svg";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { countIncomingUnread } from "@/lib/message-read";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useStudentNavMode } from "@/hooks/useStudentNavMode";

interface StudentSidebarProps {
  activeTab: string;
  onTabChange: (tab: string, extra?: Record<string, string>) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Controlado pelo portal para sync com padding do main */
  navMode?: "compact" | "expanded";
  onToggleNavMode?: () => void;
}

const StudentSidebar = ({
  activeTab,
  onTabChange,
  mobileOpen = false,
  onMobileOpenChange,
  navMode: navModeProp,
  onToggleNavMode,
}: StudentSidebarProps) => {
  const { signOut, user } = useAuth();
  const { isReady, identity } = useDataContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const internalNav = useStudentNavMode();
  const mode = navModeProp ?? internalNav.mode;
  const isCompact = mode === "compact";
  const toggle = onToggleNavMode ?? internalNav.toggle;
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [animateBadge, setAnimateBadge] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadRef = useRef(0);
  const [studentName, setStudentName] = useState<string>("");
  const [studentAvatar, setStudentAvatar] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const isMarkingAsReadRef = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);
  /** Expansão temporária no hover (só desktop compact + pointer fino) */
  const [hoverExpand, setHoverExpand] = useState(false);

  const MORE_TAB_IDS = ["progress", "videos", "reports", "financial", "profile", "dashboard"];
  const coachUnreadTotal = unreadMessages + unreadCount;

  /** Labels visíveis: expandido permanente, hover expand, ou drawer mobile */
  const showLabels = !isCompact || hoverExpand || mobileOpen;
  /** Tooltips só no compact sem hover expand (desktop) */
  const showIconTooltips = isCompact && !hoverExpand && !mobileOpen;

  const getFirstName = (value?: string | null): string => {
    if (!value) return "Usuário";
    const normalized = value.trim();
    if (!normalized) return "Usuário";
    return normalized.split(/\s+/)[0] || "Usuário";
  };

  const getFirstNameFromEmail = (email?: string | null): string => {
    const rawEmail = (email || "").trim().toLowerCase();
    if (!rawEmail.includes("@")) return "Usuário";

    const localPart = rawEmail.split("@")[0] || "";
    const normalized = localPart.replace(/[._-]+/g, " ").trim();
    const firstChunk = normalized.split(" ").filter(Boolean)[0];
    if (!firstChunk) return "Usuário";
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

  const safeStudentName = studentName
    ? getFirstName(studentName)
    : identity?.nome
      ? getFirstName(identity.nome)
      : getFirstNameFromEmail(user?.email);
  const safeStudentAvatar = studentAvatar || null;
  const safeInitial = safeStudentName.charAt(0)?.toUpperCase() || "?";

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE",
    );

    if (user) {
      loadStudentProfile().catch((error) => {
        console.warn("[STUDENT-SIDEBAR] Erro ao carregar perfil do aluno (não crítico):", error);
      });
      loadUnreadCount();
      loadUnreadMessages();

      let intervalId: NodeJS.Timeout | null = null;

      if (user.role === "aluno") {
        intervalId = setInterval(() => {
          if (!isMarkingAsReadRef.current) {
            loadUnreadCount();
            loadUnreadMessages();
          }
        }, 10000);
      }

      const handleVisibilityChange = () => {
        setIsOnline(!document.hidden);
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [user, toast, identity]);

  useEffect(() => {
    if (MORE_TAB_IDS.includes(activeTab)) {
      setMoreOpen(true);
    }
  }, [activeTab]);

  const canHoverExpand = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const handleRailEnter = () => {
    if (isCompact && !mobileOpen && canHoverExpand()) setHoverExpand(true);
  };

  const handleRailLeave = () => {
    setHoverExpand(false);
  };

  const loadStudentProfile = async () => {
    if (!user?.id) {
      setStudentAvatar(null);
      return;
    }

    const baseName = identity?.nome
      ? getFirstName(identity.nome)
      : getFirstNameFromEmail(user.email);
    setStudentName(baseName);

    const profileResult = await apiClient.requestSafe<any>("/api/profiles/me");
    if (profileResult.success && profileResult.data) {
      const displayName = String(profileResult.data.display_name || "").trim();
      if (displayName) {
        setStudentName(getFirstName(displayName));
      }
      setStudentAvatar(normalizeAvatarUrl(profileResult.data.avatar_url));
      return;
    }

    setStudentAvatar(null);
  };

  const loadUnreadCount = async () => {
    if (!user) return;

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;
    if (!aluno) return;

    const turmasResult = await apiClient.requestSafe<any[]>("/api/turmas-alunos");
    const turmasAluno =
      turmasResult.success && Array.isArray(turmasResult.data) ? turmasResult.data : [];
    const turmaIds = turmasAluno.filter((t) => t.aluno_id === aluno.id).map((t) => t.turma_id);

    const avisosResult = await apiClient.requestSafe<any[]>("/api/avisos-destinatarios");
    const avisos =
      avisosResult.success && Array.isArray(avisosResult.data) ? avisosResult.data : [];

    const individualCount = avisos.filter((a) => a.aluno_id === aluno.id && a.lido === false).length;
    const classCount =
      turmaIds.length > 0
        ? avisos.filter((a) => a.lido === false && turmaIds.includes(a.turma_id)).length
        : 0;

    setUnreadCount(individualCount + classCount);
  };

  const loadUnreadMessages = async () => {
    if (!user || user.role !== "aluno") {
      setUnreadMessages(0);
      return;
    }

    const mensagensResult = await apiClient.requestSafe<any[]>("/api/mensagens");
    const mensagens =
      mensagensResult.success && Array.isArray(mensagensResult.data) ? mensagensResult.data : [];

    const newCount = countIncomingUnread(mensagens, user.id);

    if (newCount > previousUnreadRef.current && previousUnreadRef.current > 0) {
      setAnimateBadge(true);
      setTimeout(() => setAnimateBadge(false), 1000);
    }

    previousUnreadRef.current = newCount;
    setUnreadMessages(newCount);
  };

  const handleTabChange = (tab: string) => {
    if (tab === "coach") {
      const coachView =
        unreadMessages > 0 ? "chat" : unreadCount > 0 ? "avisos" : "chat";
      onTabChange("coach", { coachView });
    } else {
      onTabChange(tab);
    }
    onMobileOpenChange?.(false);
  };

  const isTabActive = (tabId: string): boolean => {
    if (tabId === "coach") {
      return activeTab === "coach" || activeTab === "chat" || activeTab === "messages";
    }
    if (tabId === "hoje") {
      return activeTab === "hoje" || activeTab === "dashboard";
    }
    return activeTab === tabId;
  };

  const handleLogout = async () => {
    onMobileOpenChange?.(false);
    await signOut();
    navigate("/auth");
  };

  const handleToggleMode = () => {
    setHoverExpand(false);
    toggle();
  };

  type MenuItem = {
    id: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
  };

  const primaryMenuItems: MenuItem[] = [
    { id: "hoje", label: "Hoje", icon: CalendarDays },
    { id: "diet", label: "Dieta", icon: Utensils },
    { id: "workouts", label: "Treinos", icon: Dumbbell },
    { id: "coach", label: "Coach", icon: MessageSquare, badge: coachUnreadTotal },
    { id: "checkin", label: "Check-in", icon: ClipboardCheck },
  ];

  const moreMenuItems: MenuItem[] = [
    { id: "progress", label: "Fotos e métricas", icon: Camera },
    { id: "videos", label: "Vídeos", icon: Play },
    { id: "reports", label: "Relatórios", icon: FileText },
    { id: "financial", label: "Financeiro", icon: DollarSign },
    { id: "profile", label: "Perfil", icon: User },
  ];

  const renderMenuButton = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = isTabActive(item.id);
    const itemBadge = typeof item.badge === "number" ? item.badge : undefined;

    const button = (
      <Button
        variant={isActive ? "default" : "ghost"}
        className={cn(
          "relative w-full min-h-11 transition-[width,padding,background-color,color] duration-200 ease-out motion-reduce:transition-none",
          showLabels ? "justify-start px-3" : "justify-center px-0",
        )}
        onClick={() => handleTabChange(item.id)}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className={cn("h-4 w-4 shrink-0", showLabels && "mr-3")} aria-hidden />
        <span
          className={cn(
            "truncate transition-opacity duration-150 motion-reduce:transition-none",
            showLabels ? "opacity-100" : "sr-only opacity-0",
          )}
        >
          {item.label}
        </span>
        {itemBadge !== undefined && itemBadge > 0 && (
          <Badge
            variant="destructive"
            className={cn(
              showLabels ? "ml-auto" : "absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]",
              animateBadge && item.id === "coach" && "motion-safe:animate-bounce",
            )}
          >
            {itemBadge > 9 ? "9+" : itemBadge}
          </Badge>
        )}
      </Button>
    );

    if (!showIconTooltips) {
      return <div key={item.id}>{button}</div>;
    }

    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  const showSkeleton = !isReady;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-[110] bg-black/60 md:hidden"
          onClick={() => onMobileOpenChange?.(false)}
        />
      )}
      <aside
        data-nav-mode={mode}
        data-hover-expand={hoverExpand ? "true" : "false"}
        onMouseEnter={handleRailEnter}
        onMouseLeave={handleRailLeave}
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r border-border bg-card",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          /* Desktop: compact w-16 / expandido ou hover w-64 */
          "md:z-auto md:sticky md:top-0 md:self-start md:h-dvh md:max-h-dvh md:shadow-none",
          showLabels ? "md:w-64" : "md:w-16",
          /* Mobile: menu lateral só via hamburger */
          "max-md:hidden",
          mobileOpen && "max-md:!flex",
          mobileOpen &&
            "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[120] max-md:flex max-md:h-full max-md:w-[min(288px,88vw)] max-md:shadow-xl",
        )}
        aria-label="Navegação principal"
      >
        <div
          className={cn(
            "flex items-center border-b border-border",
            showLabels ? "justify-between gap-2 p-4" : "justify-center p-3",
          )}
        >
          <img
            src={logoWhite}
            alt="Black House"
            className={cn(
              "w-auto transition-all duration-200 motion-reduce:transition-none",
              showLabels ? "h-10" : "h-7",
            )}
          />
        </div>

        <ScrollArea className="flex-1">
          <nav className={cn("space-y-1", showLabels ? "p-3" : "p-2")} aria-label="Secções">
            <TooltipProvider delayDuration={300}>
              {showSkeleton ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className={cn("h-11", showLabels ? "w-full" : "mx-auto w-11")}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {primaryMenuItems.map(renderMenuButton)}

                  <Collapsible
                    open={moreOpen}
                    onOpenChange={setMoreOpen}
                    className="pt-2 md:hidden"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="min-h-11 w-full justify-between text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-3">
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                          Mais
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform motion-reduce:transition-none",
                            moreOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 pt-1">
                      {moreMenuItems.map(renderMenuButton)}
                    </CollapsibleContent>
                  </Collapsible>

                  <div
                    className={cn(
                      "hidden border-t border-border/60 pt-3 md:block",
                      showLabels ? "space-y-1" : "space-y-1",
                    )}
                  >
                    {showLabels && (
                      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Mais
                      </p>
                    )}
                    {moreMenuItems.map(renderMenuButton)}
                  </div>
                </>
              )}
            </TooltipProvider>
          </nav>
        </ScrollArea>

        <div
          className={cn(
            "border-t border-border",
            showLabels ? "space-y-2 p-3" : "space-y-2 p-2",
          )}
        >
          {/* Toggle desktop — sempre visível */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "min-h-11 w-full transition-all duration-200 motion-reduce:transition-none",
                    showLabels ? "justify-start px-3" : "justify-center px-0",
                  )}
                  onClick={handleToggleMode}
                  aria-pressed={!isCompact}
                  aria-label={
                    isCompact
                      ? "Expandir navegação (mostrar nomes)"
                      : "Recolher navegação (só ícones)"
                  }
                >
                  {isCompact ? (
                    <PanelLeftOpen className={cn("h-4 w-4 shrink-0", showLabels && "mr-3")} aria-hidden />
                  ) : (
                    <PanelLeftClose className={cn("h-4 w-4 shrink-0", showLabels && "mr-3")} aria-hidden />
                  )}
                  <span className={cn(showLabels ? "truncate" : "sr-only")}>
                    {isCompact ? "Expandir menu" : "Recolher menu"}
                  </span>
                </Button>
              </TooltipTrigger>
              {showIconTooltips && (
                <TooltipContent side="right" sideOffset={8}>
                  <p>{isCompact ? "Expandir menu" : "Recolher menu"}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <div
            className={cn(
              "flex items-center rounded-lg transition-colors motion-reduce:transition-none",
              showLabels ? "gap-3 p-2 hover:bg-muted/50" : "justify-center p-1",
            )}
          >
            <div className="relative shrink-0">
              <Avatar className={cn(showLabels ? "h-10 w-10" : "h-9 w-9")}>
                <AvatarImage src={safeStudentAvatar || undefined} alt={safeStudentName} />
                <AvatarFallback className="bg-primary/10 font-medium text-primary">
                  {safeInitial}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background transition-colors",
                  isOnline ? "bg-green-500" : "bg-muted-foreground",
                )}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
            <span
              className={cn(
                "truncate text-sm font-medium text-foreground",
                showLabels ? "opacity-100" : "sr-only",
              )}
            >
              {safeStudentName}
            </span>
          </div>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "min-h-11 w-full",
                    showLabels ? "justify-start px-3" : "justify-center px-0",
                  )}
                  onClick={handleLogout}
                  aria-label="Sair"
                >
                  <LogOut className={cn("h-4 w-4 shrink-0", showLabels && "mr-3")} aria-hidden />
                  <span className={cn(showLabels ? "" : "sr-only")}>Sair</span>
                </Button>
              </TooltipTrigger>
              {showIconTooltips && (
                <TooltipContent side="right" sideOffset={8}>
                  <p>Sair</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>
    </>
  );
};

export default StudentSidebar;
