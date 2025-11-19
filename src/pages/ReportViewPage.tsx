import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";
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
      loadReport();
    }
  }, [id]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("relatorios")
        .select(`
          *,
          alunos (
            nome,
            email
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setReport(data);
    } catch (error: any) {
      toast.error("Erro ao carregar relatório: " + error.message);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar - escondido na impressão */}
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir/Salvar PDF
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-white print:shadow-none rounded-lg shadow-lg p-8 print:p-0">
          {/* Header */}
          <div className="border-b-2 border-gray-200 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {report.titulo}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-semibold">Aluno:</p>
                <p className="text-base">{report.alunos.nome}</p>
                <p className="text-xs">{report.alunos.email}</p>
              </div>
              <div>
                <p className="font-semibold">Período:</p>
                <p className="text-base">
                  {format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} 
                  {" até "}
                  {format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Métricas de Desempenho */}
          {report.metricas && Object.keys(report.metricas).length > 0 && (
            <div className="mb-8 page-break-inside-avoid">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Métricas de Desempenho
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(report.metricas).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-sm font-medium text-gray-600 mb-1">{key}</p>
                    <p className="text-2xl font-bold text-gray-900">{value as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard de Progresso */}
          <div className="mb-8 page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Dashboard de Progresso
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <StudentProgressDashboard studentId={report.aluno_id} />
            </div>
          </div>

          {/* Observações */}
          {report.observacoes && (
            <div className="mb-8 page-break-inside-avoid">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Observações e Feedback
              </h2>
              <div className="bg-gray-50 p-6 rounded-lg border">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {report.observacoes}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-gray-200 pt-6 mt-8">
            <p className="text-xs text-gray-500 text-center">
              Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportViewPage;
