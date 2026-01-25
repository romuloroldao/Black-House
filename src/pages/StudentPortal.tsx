import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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

// RBAC-01: StudentPortal usa payment_status do contexto (via ProtectedRoute)
// A tela de bloqueio é rota separada (/portal-aluno/blocked)
// O ProtectedRoute já redireciona alunos inadimplentes automaticamente
const StudentPortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "dashboard");
  const { user } = useAuth();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
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
      <div className="flex min-h-screen w-full bg-background">
        <StudentSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <main className="flex-1 p-6 lg:p-8">
          <div className="flex justify-end mb-4">
            <NotificationsPopover onNavigate={handleTabChange} />
          </div>
          {content}
        </main>
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
