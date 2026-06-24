import { useEffect, useState } from "react";
import StudentOnboardingDialog, {
  isStudentOnboardingDone,
} from "@/components/student/StudentOnboardingDialog";
import { useSearchParams } from "react-router-dom";
import { Menu } from "lucide-react";
import StudentSidebar from "@/components/student/StudentSidebar";
import StudentTodayView from "@/components/student/StudentTodayView";
import StudentBottomNav, { shouldShowMobileBottomNav } from "@/components/student/StudentBottomNav";
import { useAlunoHoje } from "@/hooks/useAlunoHoje";
import { useAuth } from "@/contexts/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import StudentDietView from "@/components/student/StudentDietView";
import StudentWorkoutsView from "@/components/student/StudentWorkoutsView";
import StudentVideosView from "@/components/student/StudentVideosView";
import StudentCoachHubView from "@/components/student/StudentCoachHubView";
import StudentProgressView from "@/components/student/StudentProgressView";
import StudentFinancialView from "@/components/student/StudentFinancialView";
import StudentProfileView from "@/components/student/StudentProfileView";
import ProfileCompletionWizard from "@/components/student/ProfileCompletionWizard";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import StudentReportsView from "@/components/student/StudentReportsView";
import StudentWeeklyCheckin from "@/components/student/StudentWeeklyCheckin";
import NotificationsPopover from "@/components/NotificationsPopover";
import { useStudentPortalRealtime } from "@/hooks/useStudentPortalRealtime";
import { Button } from "@/components/ui/button";
import logoWhite from "@/assets/logo-white.svg";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

// RBAC-01: StudentPortal usa payment_status do contexto (via ProtectedRoute)
// A tela de bloqueio é rota separada (/portal-aluno/blocked)
// O ProtectedRoute já redireciona alunos inadimplentes automaticamente
const StudentPortal = () => {
  const { user } = useAuth();
  const { isReady } = useDataContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "hoje");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileWizardOpen, setProfileWizardOpen] = useState(false);
  const hojeState = useAlunoHoje(Boolean(isReady && user));
  const { coachUnreadTotal } = hojeState;
  const { status: profileStatus, refetch: refetchProfile } = useProfileCompleteness();
  const [profileSeed, setProfileSeed] = useState<{
    nome?: string;
    telefone?: string;
    data_nascimento?: string;
    sexo?: string;
    peso_kg?: string;
    altura_cm?: string;
  }>({});

  useEffect(() => {
    let tab = searchParams.get("tab") || "hoje";
    if (tab === "dashboard") {
      setSearchParams({ tab: "hoje" }, { replace: true });
      setActiveTab("hoje");
      return;
    }
    if (tab === "chat" || tab === "messages") {
      setSearchParams(
        { tab: "coach", coachView: tab === "chat" ? "chat" : "avisos" },
        { replace: true },
      );
      setActiveTab("coach");
      return;
    }
    setActiveTab(tab);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isReady && user?.role === "aluno" && !isStudentOnboardingDone()) {
      setOnboardingOpen(true);
    }
  }, [isReady, user?.role]);

  useEffect(() => {
    if (!isReady || !profileStatus || profileStatus.is_complete) return;
    const key = "bh-profile-wizard-shown";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    void (async () => {
      const me = await apiClient.getMeSafe();
      const aluno = me.success ? me.data : null;
      setProfileSeed({
        nome: aluno?.nome || "",
        telefone: aluno?.telefone || "",
        data_nascimento: (aluno?.data_nascimento || "").split("T")[0] || "",
        sexo: aluno?.sexo || "",
        peso_kg:
          aluno?.peso_kg != null
            ? String(aluno.peso_kg)
            : aluno?.peso != null
              ? String(aluno.peso)
              : "",
        altura_cm:
          aluno?.altura_cm != null
            ? String(aluno.altura_cm)
            : aluno?.altura != null
              ? String(aluno.altura)
              : "",
      });
      setProfileWizardOpen(true);
    })();
  }, [isReady, profileStatus?.is_complete]);

  const handleTabChange = (tab: string, extra?: Record<string, string>) => {
    setActiveTab(tab);
    setSearchParams({ tab, ...extra });
    setMobileNavOpen(false);
  };

  useStudentPortalRealtime({ onNavigate: handleTabChange });

  useEffect(() => {
    const onRealtime = () => {
      void hojeState.refetch();
    };
    window.addEventListener("blackhouse:student-realtime", onRealtime);
    return () => window.removeEventListener("blackhouse:student-realtime", onRealtime);
  }, [hojeState.refetch]);

  // DESIGN-ROOT-RENDER-UNBLOCK-001: renderContent deve sempre retornar componente válido
  const renderContent = () => {
    try {
      switch (activeTab) {
        case "hoje":
        case "dashboard":
          return (
            <StudentTodayView
              hojeState={hojeState}
              profileStatus={profileStatus}
              onOpenProfileWizard={() => setProfileWizardOpen(true)}
            />
          );
        case "diet":
          return <StudentDietView />;
        case "workouts":
          return <StudentWorkoutsView />;
        case "videos":
          return <StudentVideosView />;
        case "coach":
        case "chat":
        case "messages":
          return <StudentCoachHubView />;
        case "reports":
          return <StudentReportsView />;
        case "progress":
          return <StudentProgressView />;
        case "financial":
          return <StudentFinancialView />;
        case "profile":
          return <StudentProfileView />;
        case "checkin":
          return (
            <StudentWeeklyCheckin
              checkinStreak={hojeState.data?.checkin_streak ?? null}
              checkinLoading={hojeState.loading}
              onCheckinSubmitted={() => void hojeState.refetch()}
              profileStatus={profileStatus}
              onRequireProfile={() => setProfileWizardOpen(true)}
            />
          );
        default:
          return <StudentTodayView />;
      }
    } catch (error) {
      // DESIGN-ROOT-RENDER-UNBLOCK-001: Fallback seguro em caso de erro
      console.warn('[DESIGN-ROOT-RENDER-UNBLOCK-001] Erro ao renderizar conteúdo do StudentPortal. Usando fallback:', error);
      return <StudentTodayView />;
    }
  };

  // DESIGN-ROOT-RENDER-UNBLOCK-001: Garantir que sempre retorna JSX válido
  try {
    const content = renderContent();
    const showMobileBottomNav = shouldShowMobileBottomNav(activeTab);
    if (!content) {
      // DESIGN-ROOT-RENDER-UNBLOCK-001: Se renderContent retornar null/undefined, usar fallback
      console.warn('[DESIGN-ROOT-RENDER-UNBLOCK-001] renderContent retornou null/undefined. Usando fallback.');
      return (
        <div className="flex min-h-screen w-full bg-background items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-background">
        <a
          href="#student-main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Ir para o conteúdo
        </a>
        <StudentSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col max-md:pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
          <header className="flex h-14 min-h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-[100] max-md:min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)] max-md:shadow-md md:static md:top-auto md:z-30 md:min-h-14 md:pt-0 md:shadow-none bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden">
            <Button
              type="button"
              variant="secondary"
              className="h-11 shrink-0 gap-2 border border-primary/40 bg-primary/15 px-3 text-foreground shadow-sm hover:bg-primary/25 active:bg-primary/30"
              aria-label="Abrir menu de navegação"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6 shrink-0 text-primary" strokeWidth={2.75} aria-hidden />
              <span className="text-sm font-semibold tracking-wide">Menu</span>
            </Button>
            <img src={logoWhite} alt="Black House" className="h-8 w-auto" />
            <div className="ml-auto flex shrink-0 items-center">
              <NotificationsPopover onNavigate={handleTabChange} />
            </div>
          </header>
          <main
            id="student-main-content"
            tabIndex={-1}
            aria-live="polite"
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]",
              "px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8",
              showMobileBottomNav ? "max-md:pb-student-main md:pb-6" : "max-md:pb-student-main-compact md:pb-6",
            )}
          >
            <div className="mb-4 hidden justify-end md:flex">
              <NotificationsPopover onNavigate={handleTabChange} />
            </div>
            <div key={activeTab} className="student-tab-enter min-w-0">
              {content}
            </div>
          </main>
          <StudentOnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
          <ProfileCompletionWizard
            open={profileWizardOpen}
            onOpenChange={setProfileWizardOpen}
            status={profileStatus}
            initialData={profileSeed}
            onCompleted={() => void refetchProfile()}
          />
          {showMobileBottomNav ? (
            <StudentBottomNav
              activeTab={activeTab}
              onTabChange={handleTabChange}
              coachBadge={coachUnreadTotal}
            />
          ) : null}
        </div>
      </div>
    );
  } catch (error) {
    // DESIGN-ROOT-RENDER-UNBLOCK-001: Fallback mínimo se houver erro estrutural
    console.error('[DESIGN-ROOT-RENDER-UNBLOCK-001] Erro crítico no StudentPortal:', error);
    return (
      <div className="flex min-h-screen w-full bg-background items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
};

export default StudentPortal;
