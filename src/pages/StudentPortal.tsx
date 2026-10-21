import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import StudentSidebar from "@/components/student/StudentSidebar";
import StudentBottomNav from "@/components/student/StudentBottomNav";
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
import StudentColemanView from "@/components/student/StudentColemanView";

import NotificationsPopover from "@/components/NotificationsPopover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Loader2, LogOut } from "lucide-react";
import { trackStudentEvent } from "@/lib/studentAnalytics";
import { cn } from "@/lib/utils";

const StudentPortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isInadimplente, setIsInadimplente] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    const tab = searchParams.get("tab") || "dashboard";
    setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    checkPaymentStatus();
  }, [user]);

  useEffect(() => {
    trackStudentEvent("student_tab_view", { tab: activeTab });
  }, [activeTab]);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;

    const loadBadges = async () => {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (!aluno || cancelled) return;

      const { data: conversa } = await supabase
        .from("conversas")
        .select("id")
        .eq("aluno_id", aluno.id)
        .maybeSingle();

      if (conversa) {
        const { count } = await supabase
          .from("mensagens")
          .select("*", { count: "exact", head: true })
          .eq("conversa_id", conversa.id)
          .eq("lida", false)
          .neq("remetente_id", user.id);
        if (!cancelled) setUnreadMessages(count || 0);
      }

      const { data: turmasAluno } = await supabase
        .from("turmas_alunos")
        .select("turma_id")
        .eq("aluno_id", aluno.id);

      const turmaIds = turmasAluno?.map((t) => t.turma_id) || [];

      const { count: individualCount } = await supabase
        .from("avisos_destinatarios")
        .select("*", { count: "exact", head: true })
        .eq("aluno_id", aluno.id)
        .eq("lido", false);

      let classCount = 0;
      if (turmaIds.length > 0) {
        const { count } = await supabase
          .from("avisos_destinatarios")
          .select("*", { count: "exact", head: true })
          .in("turma_id", turmaIds)
          .eq("lido", false);
        classCount = count || 0;
      }

      if (!cancelled) {
        setUnreadAnnouncements((individualCount || 0) + classCount);
      }
    };

    loadBadges();
    return () => {
      cancelled = true;
    };
  }, [user, activeTab]);

  const checkPaymentStatus = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!aluno) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: overduePayments } = await supabase
        .from("asaas_payments")
        .select("id, status, due_date")
        .eq("aluno_id", aluno.id)
        .or(`status.eq.OVERDUE,and(status.eq.PENDING,due_date.lt.${today})`);

      setIsInadimplente((overduePayments?.length || 0) > 0);
    } catch (error) {
      console.error("Erro ao verificar status de pagamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isInadimplente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">
              Acesso Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Seu acesso à plataforma está temporariamente suspenso devido a
              pendências financeiras.
            </p>
            <p className="text-sm text-muted-foreground">
              Para regularizar sua situação e restaurar o acesso, entre em
              contato com seu coach ou efetue o pagamento das parcelas em aberto.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              <Button
                onClick={() => {
                  setIsInadimplente(false);
                  handleTabChange("financial");
                }}
                className="w-full gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Ver Pendências
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <StudentDashboardView onNavigate={handleTabChange} />;
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
      case "coleman":
        return <StudentColemanView onNavigate={handleTabChange} />;
      default:
        return <StudentDashboardView onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="hidden md:flex">
        <StudentSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <main
        className={cn(
          "flex-1 min-w-0",
          isMobile ? "p-4 pb-24" : "p-6 lg:p-8"
        )}
      >
        <div className="flex justify-end mb-4">
          <NotificationsPopover onNavigate={handleTabChange} />
        </div>
        {renderContent()}
      </main>

      <StudentBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMessages={unreadMessages}
        unreadAnnouncements={unreadAnnouncements}
      />
    </div>
  );
};

export default StudentPortal;
