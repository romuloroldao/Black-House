import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Megaphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import StudentChatView from "@/components/student/StudentChatView";
import StudentMessagesView from "@/components/student/StudentMessagesView";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type CoachHubView = "chat" | "avisos";

const StudentCoachHubView = () => {
  const { user } = useAuth();
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadAvisos, setUnreadAvisos] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("coachView");
  const activeView: CoachHubView = rawView === "avisos" ? "avisos" : "chat";

  const setView = (view: CoachHubView) => {
    setSearchParams({ tab: "coach", coachView: view });
  };

  const refreshUnread = useCallback(async () => {
    if (!user || user.role !== "aluno") {
      setUnreadChat(0);
      setUnreadAvisos(0);
      return;
    }

    const mensagensResult = await apiClient.requestSafe<any[]>("/api/mensagens");
    const mensagens =
      mensagensResult.success && Array.isArray(mensagensResult.data)
        ? mensagensResult.data
        : [];
    setUnreadChat(
      mensagens.filter((m) => m.destinatario_id === user.id && !m.lida).length,
    );

    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;
    if (!aluno) {
      setUnreadAvisos(0);
      return;
    }

    const turmasResult = await apiClient.requestSafe<any[]>("/api/turmas-alunos");
    const turmasAluno =
      turmasResult.success && Array.isArray(turmasResult.data) ? turmasResult.data : [];
    const turmaIds = turmasAluno.filter((t) => t.aluno_id === aluno.id).map((t) => t.turma_id);
    const avisosResult = await apiClient.requestSafe<any[]>("/api/avisos-destinatarios");
    const avisos =
      avisosResult.success && Array.isArray(avisosResult.data) ? avisosResult.data : [];
    const individual = avisos.filter((a) => a.aluno_id === aluno.id && a.lido === false).length;
    const turma =
      turmaIds.length > 0
        ? avisos.filter((a) => a.lido === false && turmaIds.includes(a.turma_id)).length
        : 0;
    setUnreadAvisos(individual + turma);
  }, [user]);

  useEffect(() => {
    void refreshUnread();
    const id = setInterval(() => void refreshUnread(), 10000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (activeView === "chat" && unreadChat > 0) {
      void markChatAsRead();
    } else if (activeView === "avisos" && unreadAvisos > 0) {
      void markAvisosAsRead();
    }
  }, [activeView, unreadChat, unreadAvisos, user?.id]);

  const markChatAsRead = async () => {
    if (!user || user.role !== "aluno") return;

    const mensagensResult = await apiClient.requestSafe<any[]>("/api/mensagens");
    const mensagens =
      mensagensResult.success && Array.isArray(mensagensResult.data)
        ? mensagensResult.data
        : [];
    const naoLidas = mensagens.filter(
      (m) => m.destinatario_id === user.id && !m.lida,
    );
    for (const msg of naoLidas) {
      await apiClient.requestSafe(`/api/mensagens/${msg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lida: true }),
      });
    }
    setUnreadChat(0);
  };

  const markAvisosAsRead = async () => {
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

    const toMark = avisos.filter(
      (a) =>
        a.lido === false &&
        (a.aluno_id === aluno.id || (turmaIds.length > 0 && turmaIds.includes(a.turma_id))),
    );

    for (const aviso of toMark) {
      await apiClient.requestSafe(`/api/avisos-destinatarios/${aviso.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lido: true, lido_em: new Date().toISOString() }),
      });
    }
    setUnreadAvisos(0);
  };

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <div className="md:px-2 lg:px-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Coach</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Chat direto e avisos do seu coach num só lugar
        </p>
      </div>

      <Tabs
        value={activeView}
        onValueChange={(v) => setView(v as CoachHubView)}
        className="min-w-0 md:px-2 lg:px-4"
      >
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 md:mx-0">
          <TabsTrigger value="chat" className="gap-2 py-2.5">
            <MessageSquare className="h-4 w-4" />
            Chat
            {unreadChat > 0 && (
              <Badge variant="destructive" className="student-badge-sm ml-1 h-5 min-w-5 px-1">
                {unreadChat > 9 ? "9+" : unreadChat}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="avisos" className="gap-2 py-2.5">
            <Megaphone className="h-4 w-4" />
            Avisos
            {unreadAvisos > 0 && (
              <Badge variant="destructive" className="student-badge-sm ml-1 h-5 min-w-5 px-1">
                {unreadAvisos > 9 ? "9+" : unreadAvisos}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4 min-w-0 focus-visible:outline-none">
          <StudentChatView />
        </TabsContent>
        <TabsContent value="avisos" className="mt-4 min-w-0 focus-visible:outline-none md:mt-5">
          <div className="mx-auto w-full max-w-3xl md:max-w-4xl">
            <StudentMessagesView />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentCoachHubView;
