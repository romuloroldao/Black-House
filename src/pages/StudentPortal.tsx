import { useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";
import NotificationsPopover from "@/components/NotificationsPopover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Loader2, LogOut } from "lucide-react";

const StudentPortal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "dashboard");
  const [isInadimplente, setIsInadimplente] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();

  useEffect(() => {
    checkPaymentStatus();
  }, [user]);

  const checkPaymentStatus = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      // Get student ID by email
      const { data: aluno } = await supabase
        .from('alunos')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!aluno) {
        setLoading(false);
        return;
      }

      // Check for overdue payments (OVERDUE status or PENDING past due date)
      const today = new Date().toISOString().split('T')[0];
      const { data: overduePayments } = await supabase
        .from('asaas_payments')
        .select('id, status, due_date')
        .eq('aluno_id', aluno.id)
        .or(`status.eq.OVERDUE,and(status.eq.PENDING,due_date.lt.${today})`);

      // Student is delinquent if they have any overdue payments
      setIsInadimplente((overduePayments?.length || 0) > 0);
    } catch (error) {
      console.error('Erro ao verificar status de pagamento:', error);
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

  // Show blocked screen for delinquent students
  if (isInadimplente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">Acesso Bloqueado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Seu acesso à plataforma está temporariamente suspenso devido a pendências financeiras.
            </p>
            <p className="text-sm text-muted-foreground">
              Para regularizar sua situação e restaurar o acesso, entre em contato com seu coach ou efetue o pagamento das parcelas em aberto.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              <Button 
                onClick={() => { setIsInadimplente(false); handleTabChange('financial'); }}
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
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <StudentSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 p-6 lg:p-8">
        <div className="flex justify-end mb-4">
          <NotificationsPopover onNavigate={handleTabChange} />
        </div>
        {renderContent()}
      </main>
    </div>
  );
};

export default StudentPortal;