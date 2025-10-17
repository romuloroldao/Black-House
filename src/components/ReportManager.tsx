import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, Send, Eye, Edit, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReportForm from "./ReportForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Report {
  id: string;
  titulo: string;
  aluno_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: string;
  enviado_em: string | null;
  visualizado_em: string | null;
  created_at: string;
  alunos: {
    nome: string;
    email: string;
  };
}

const ReportManager = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    enviados: 0,
    visualizados: 0,
    rascunhos: 0,
  });

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
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
        .eq("coach_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReports(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const enviados = data?.filter((r) => r.status === "enviado").length || 0;
      const visualizados = data?.filter((r) => r.status === "visualizado").length || 0;
      const rascunhos = data?.filter((r) => r.status === "rascunho").length || 0;

      setStats({ total, enviados, visualizados, rascunhos });
    } catch (error: any) {
      toast.error("Erro ao carregar relatórios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("relatorios")
        .update({ 
          status: "enviado", 
          enviado_em: new Date().toISOString() 
        })
        .eq("id", reportId);

      if (error) throw error;

      toast.success("Relatório enviado com sucesso!");
      loadReports();
    } catch (error: any) {
      toast.error("Erro ao enviar relatório: " + error.message);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Tem certeza que deseja excluir este relatório?")) return;

    try {
      const { error } = await supabase
        .from("relatorios")
        .delete()
        .eq("id", reportId);

      if (error) throw error;

      toast.success("Relatório excluído com sucesso!");
      loadReports();
    } catch (error: any) {
      toast.error("Erro ao excluir relatório: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      rascunho: { variant: "secondary", label: "Rascunho" },
      enviado: { variant: "default", label: "Enviado" },
      visualizado: { variant: "premium", label: "Visualizado" },
    };
    const config = variants[status] || variants.rascunho;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredReports = reports.filter(
    (report) =>
      report.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.alunos?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Relatórios de Progresso</h1>
          <p className="text-muted-foreground">
            Gerencie relatórios e acompanhe o desenvolvimento dos alunos
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} variant="premium">
          <Plus className="h-4 w-4 mr-2" />
          Novo Relatório
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Relatórios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.total}</span>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rascunhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.rascunhos}</span>
              <Edit className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.enviados}</span>
              <Send className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visualizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.visualizados}</span>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Todos os Relatórios</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filteredReports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum relatório encontrado
            </p>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{report.titulo}</h3>
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Aluno: {report.alunos?.nome || "Não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Período: {format(new Date(report.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                      {format(new Date(report.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    {report.visualizado_em && (
                      <p className="text-xs text-green-600 mt-1">
                        Visualizado em {format(new Date(report.visualizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {report.status === "rascunho" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleSendReport(report.id)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReport(report.id);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport ? "Editar Relatório" : "Novo Relatório"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do relatório de progresso do aluno
            </DialogDescription>
          </DialogHeader>
          <ReportForm
            reportId={selectedReport}
            onSuccess={() => {
              setIsFormOpen(false);
              setSelectedReport(null);
              loadReports();
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedReport(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportManager;
