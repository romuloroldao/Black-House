import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, MessageSquare, TrendingUp, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Report {
  id: string;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string;
  metricas: any;
  observacoes: string;
  enviado_em: string;
  visualizado_em: string | null;
  created_at: string;
}

interface Feedback {
  id: string;
  comentario: string;
  created_at: string;
}

interface ReportMedia {
  id: string;
  url: string;
  tipo: string;
  legenda: string | null;
  ordem: number;
}

const StudentReportsView = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [reportMedia, setReportMedia] = useState<ReportMedia[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [alunoId, setAlunoId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadReports();
  }, [user]);

  const loadReports = async () => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user?.email)
        .maybeSingle();

      if (aluno) {
        setAlunoId(aluno.id);

        const { data, error } = await supabase
          .from("relatorios")
          .select("*")
          .eq("aluno_id", aluno.id)
          .in("status", ["enviado", "visualizado"])
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReports(data || []);

        const unvisualized = data?.filter((r) => !r.visualizado_em) || [];
        if (unvisualized.length > 0) {
          await supabase
            .from("relatorios")
            .update({
              status: "visualizado",
              visualizado_em: new Date().toISOString(),
            })
            .in(
              "id",
              unvisualized.map((r) => r.id)
            );
        }
      }
    } catch (error: any) {
      toast.error("Erro ao carregar relatórios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from("relatorio_feedbacks")
        .select("*")
        .eq("relatorio_id", reportId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar feedbacks: " + error.message);
    }
  };

  const loadReportMedia = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from("relatorio_midias")
        .select("*")
        .eq("relatorio_id", reportId)
        .order("ordem");
      if (error) throw error;
      setReportMedia(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar mídias: " + error.message);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedReport || !newFeedback.trim() || !alunoId) return;
    try {
      const { error } = await supabase.from("relatorio_feedbacks").insert({
        relatorio_id: selectedReport.id,
        aluno_id: alunoId,
        comentario: newFeedback,
      });
      if (error) throw error;
      toast.success("Feedback enviado com sucesso!");
      setNewFeedback("");
      loadFeedbacks(selectedReport.id);
    } catch (error: any) {
      toast.error("Erro ao enviar feedback: " + error.message);
    }
  };

  const openReport = (report: Report) => {
    setSelectedReport(report);
    loadFeedbacks(report.id);
    loadReportMedia(report.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeReport = () => {
    setSelectedReport(null);
    setNewFeedback("");
  };

  // —— Detalhe full-screen (substitui Dialog desktop) ——
  if (selectedReport) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto pb-8">
        <Button
          variant="ghost"
          className="min-h-[44px] -ml-2"
          onClick={closeReport}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar aos relatórios
        </Button>

        <div>
          <h1 className="text-2xl font-bold leading-tight">
            {selectedReport.titulo}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Período:{" "}
            {format(new Date(selectedReport.periodo_inicio), "dd/MM/yyyy", {
              locale: ptBR,
            })}{" "}
            até{" "}
            {format(new Date(selectedReport.periodo_fim), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </p>
        </div>

        {selectedReport.metricas &&
          Object.keys(selectedReport.metricas).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métricas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2">
                  {Object.entries(selectedReport.metricas).map(
                    ([key, value]) => (
                      <div key={key} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          {key}
                        </p>
                        <p className="text-lg font-bold break-words">
                          {String(value)}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        {selectedReport.observacoes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações do coach</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {selectedReport.observacoes}
              </p>
            </CardContent>
          </Card>
        )}

        {reportMedia.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos anexadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reportMedia.map((media) => (
                  <div key={media.id} className="space-y-2">
                    <img
                      src={media.url}
                      alt={media.legenda || "Foto do relatório"}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    {media.legenda && (
                      <p className="text-sm text-muted-foreground">
                        {media.legenda}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comentários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm mb-1">{feedback.comentario}</p>
                <p className="text-xs text-muted-foreground">
                  {format(
                    new Date(feedback.created_at),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            ))}

            <div className="space-y-2">
              <Textarea
                placeholder="Comentário ou dúvida sobre o relatório..."
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleSubmitFeedback}
                disabled={!newFeedback.trim()}
                className="w-full min-h-[44px]"
              >
                Enviar comentário
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Meus Relatórios</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Feedback do seu coach sobre o período
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Você ainda não tem relatórios disponíveis
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-2">
                  <CardTitle className="text-lg leading-snug flex-1">
                    {report.titulo}
                  </CardTitle>
                  <Badge variant="premium" className="shrink-0">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Progresso
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(report.periodo_inicio), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}{" "}
                  –{" "}
                  {format(new Date(report.periodo_fim), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Enviado em{" "}
                  {format(new Date(report.enviado_em), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
                <Button
                  className="w-full min-h-[44px]"
                  onClick={() => openReport(report)}
                >
                  Abrir relatório
                </Button>
              </CardHeader>
              {report.metricas && Object.keys(report.metricas).length > 0 && (
                <CardContent className="pt-0">
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                    {Object.entries(report.metricas)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <div key={key} className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">
                            {key}
                          </p>
                          <p className="text-base font-bold">{String(value)}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentReportsView;
