import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";
import ReportContentGuard from "@/components/report/ReportContentGuard";
import { toast } from "sonner";

interface ReportData {
  titulo: string;
  aluno_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  observacoes: string | null;
  metricas: any;
  alunos: {
    nome: string;
    email: string;
  };
}

const ReportViewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      void loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    setLoading(true);

    const relatorioResult = await apiClient.requestSafe<any>(`/api/relatorios/${id}`);
    const relatorio = relatorioResult.success ? relatorioResult.data : null;

    if (!relatorio) {
      toast.error("Erro ao carregar relatório: relatório não encontrado");
      navigate("/");
      setLoading(false);
      return;
    }

    const alunoResult = await apiClient.requestSafe<any>(`/api/alunos/${relatorio.aluno_id}`);
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (!aluno) {
      toast.error("Erro ao carregar relatório: aluno não encontrado");
      navigate("/");
      setLoading(false);
      return;
    }

    setReport({
      ...relatorio,
      alunos: aluno,
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Relatório não encontrado</h2>
          <p className="text-muted-foreground mb-6">
            O relatório solicitado não foi encontrado ou não está mais disponível.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <ReportContentGuard>
          <div className="bg-card rounded-lg border p-8">
            <div className="border-b pb-6 mb-6">
              <h1 className="mb-2 text-xl font-bold sm:text-2xl">{report.titulo}</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Aluno:</p>
                  <p className="text-base text-foreground">{report.alunos.nome}</p>
                  <p className="text-xs">{report.alunos.email}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Período:</p>
                  <p className="text-base text-foreground">
                    {format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })}
                    {" até "}
                    {format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            {report.metricas && Object.keys(report.metricas).length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Métricas de Desempenho</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(report.metricas).map(([key, value]) => (
                    <div key={key} className="bg-muted/40 p-4 rounded-lg border">
                      <p className="text-sm font-medium text-muted-foreground mb-1">{key}</p>
                      <p className="text-2xl font-bold">{value as string}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <StudentProgressDashboard
                studentId={report.aluno_id}
                studentName={report.alunos.nome}
                asOf={report.periodo_fim}
              />
            </div>

            {report.observacoes && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Observações e Feedback</h2>
                <div className="bg-muted/40 p-6 rounded-lg border">
                  <p className="whitespace-pre-wrap">{report.observacoes}</p>
                </div>
              </div>
            )}

            <div className="border-t pt-6 mt-8">
              <p className="text-xs text-muted-foreground text-center">
                Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </ReportContentGuard>
      </div>
    </div>
  );
};

export default ReportViewPage;
