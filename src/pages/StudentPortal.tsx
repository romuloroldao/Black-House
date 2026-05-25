import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Menu } from "lucide-react";
import StudentSidebar from "@/components/student/StudentSidebar";
import StudentDashboardView from "@/components/student/StudentDashboardView";
import StudentDietView from "@/components/student/StudentDietView";
import StudentWorkoutsView from "@/components/student/StudentWorkoutsView";
import StudentVideosView from "@/components/student/StudentVideosView";
import StudentChatView from "@/components/student/StudentChatView";
import StudentProgressView from "@/components/student/StudentProgressView";
import StudentFinancialView from "@/components/student/StudentFinancialView";
import StudentProfileView from "@/components/student/StudentProfileView";
import StudentReportsView from "@/components/student/StudentReportsView";
import StudentMessagesView from "@/components/student/StudentMessagesView";
import StudentWeeklyCheckin from "@/components/student/StudentWeeklyCheckin";
import NotificationsPopover from "@/components/NotificationsPopover";
import { Button } from "@/components/ui/button";
import logoWhite from "@/assets/logo-white.svg";

// RBAC-01: StudentPortal usa payment_status do contexto (via ProtectedRoute)
// A tela de bloqueio é rota separada (/portal-aluno/blocked)
// O ProtectedRoute já redireciona alunos inadimplentes automaticamente
const StudentPortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab") || "dashboard";
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setMobileNavOpen(false);
  };

  // DESIGN-ROOT-RENDER-UNBLOCK-001: renderContent deve sempre retornar componente válido
  const renderContent = () => {
    try {
      switch (activeTab) {
        case "dashboard":
          return <StudentDashboardView />;
        case "diet":
          return <StudentDietView />;
        case "workouts":
          return <StudentWorkoutsView />;
        case "videos":
          return <StudentVideosView />;
        case "chat":
          return <StudentChatView />;
        case "messages":
          return <StudentMessagesView />;
        case "reports":
          return <StudentReportsView />;
        case "progress":
          return <StudentProgressView />;
        case "financial":
          return <StudentFinancialView />;
        case "profile":
          return <StudentProfileView />;
        case "checkin":
          return <StudentWeeklyCheckin />;
        default:
          return <StudentDashboardView />;
      }
    } catch (error) {
      // DESIGN-ROOT-RENDER-UNBLOCK-001: Fallback seguro em caso de erro
      console.warn('[DESIGN-ROOT-RENDER-UNBLOCK-001] Erro ao renderizar conteúdo do StudentPortal. Usando fallback:', error);
      return <StudentDashboardView />;
    }
  };

  // DESIGN-ROOT-RENDER-UNBLOCK-001: Garantir que sempre retorna JSX válido
  try {
    const content = renderContent();
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
      <div className="relative flex min-h-screen w-full min-w-0 bg-background">
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
          <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
            <div className="mb-4 hidden justify-end md:flex">
              <NotificationsPopover onNavigate={handleTabChange} />
            </div>
            {content}
          </main>
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
