import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, MessageSquare, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    if (user) {
      loadReports();
    }
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

        // Mark as visualized
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Meus Relatórios</h1>
        <p className="text-muted-foreground">
          Acompanhe seu progresso através dos relatórios do seu coach
        </p>
      </div>

      {loading ? (
        <Card className="shadow-card">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="shadow-card">
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
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="shadow-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 mb-2">
                      {report.titulo}
                      <Badge variant="premium">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Progresso
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Período: {format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                      {format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enviado em {format(new Date(report.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button onClick={() => openReport(report)}>Ver Detalhes</Button>
                </div>
              </CardHeader>
              {report.metricas && Object.keys(report.metricas).length > 0 && (
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-3">
                    {Object.entries(report.metricas)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="p-3 bg-muted/50 rounded-lg"
                        >
                          <p className="text-xs text-muted-foreground mb-1">{key}</p>
                          <p className="text-lg font-bold">{String(value)}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.titulo}</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Período: {format(new Date(selectedReport.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                  {format(new Date(selectedReport.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                </p>

                {selectedReport.metricas && Object.keys(selectedReport.metricas).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Métricas de Desempenho</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-2">
                        {Object.entries(selectedReport.metricas).map(([key, value]) => (
                          <div key={key} className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">{key}</p>
                            <p className="text-xl font-bold">{String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedReport.observacoes && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Observações do Coach</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{selectedReport.observacoes}</p>
                    </CardContent>
                  </Card>
                )}

                {reportMedia.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Fotos Anexadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {reportMedia.map((media) => (
                          <div key={media.id} className="space-y-2">
                            <img
                              src={media.url}
                              alt={media.legenda || "Foto do relatório"}
                              className="w-full h-48 object-cover rounded-lg shadow-card"
                            />
                            {media.legenda && (
                              <p className="text-sm text-muted-foreground">{media.legenda}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comentários e Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedbacks.map((feedback) => (
                    <div key={feedback.id} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm mb-1">{feedback.comentario}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(feedback.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Adicione seu comentário ou dúvida sobre o relatório..."
                      value={newFeedback}
                      onChange={(e) => setNewFeedback(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={!newFeedback.trim()}
                      className="w-full"
                    >
                      Enviar Comentário
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentReportsView;
