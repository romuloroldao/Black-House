import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Image } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

interface ReportFormProps {
  reportId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface MetricField {
  id: string;
  nome: string;
  valor: string;
}

interface AlunoPhoto {
  id: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

const ReportForm = ({ reportId, onSuccess, onCancel }: ReportFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunoPhotos, setAlunoPhotos] = useState<AlunoPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    titulo: "",
    aluno_id: "",
    periodo_inicio: new Date(),
    periodo_fim: new Date(),
    observacoes: "",
  });

  const [metrics, setMetrics] = useState<MetricField[]>([
    { id: "1", nome: "Frequência (%)", valor: "" },
    { id: "2", nome: "Evolução Técnica (1-10)", valor: "" },
    { id: "3", nome: "Engajamento (1-10)", valor: "" },
  ]);

  useEffect(() => {
    loadAlunos();
    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  useEffect(() => {
    if (formData.aluno_id) {
      loadAlunoPhotos();
    }
  }, [formData.aluno_id]);

  const loadAlunos = async () => {
    try {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email")
        .eq("coach_id", user?.id)
        .order("nome");

      if (error) throw error;
      setAlunos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar alunos: " + error.message);
    }
  };

  const loadAlunoPhotos = async () => {
    if (!formData.aluno_id) return;

    try {
      const { data, error } = await supabase
        .from("fotos_alunos")
        .select("*")
        .eq("aluno_id", formData.aluno_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAlunoPhotos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar fotos: " + error.message);
    }
  };

  const loadReport = async () => {
    if (!reportId) return;

    try {
      const { data, error } = await supabase
        .from("relatorios")
        .select("*")
        .eq("id", reportId)
        .single();

      if (error) throw error;

      setFormData({
        titulo: data.titulo,
        aluno_id: data.aluno_id,
        periodo_inicio: new Date(data.periodo_inicio),
        periodo_fim: new Date(data.periodo_fim),
        observacoes: data.observacoes || "",
      });

      if (data.metricas) {
        const loadedMetrics = Object.entries(data.metricas).map(([nome, valor], index) => ({
          id: String(index + 1),
          nome,
          valor: String(valor),
        }));
        if (loadedMetrics.length > 0) {
          setMetrics(loadedMetrics);
        }
      }

      // Load selected photos
      const { data: midias } = await supabase
        .from("relatorio_midias")
        .select("url")
        .eq("relatorio_id", reportId);

      if (midias) {
        setSelectedPhotos(midias.map(m => m.url));
      }
    } catch (error: any) {
      toast.error("Erro ao carregar relatório: " + error.message);
    }
  };

  const addMetric = () => {
    setMetrics([
      ...metrics,
      { id: String(Date.now()), nome: "", valor: "" },
    ]);
  };

  const removeMetric = (id: string) => {
    setMetrics(metrics.filter((m) => m.id !== id));
  };

  const updateMetric = (id: string, field: "nome" | "valor", value: string) => {
    setMetrics(
      metrics.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos(prev =>
      prev.includes(photoUrl)
        ? prev.filter(url => url !== photoUrl)
        : [...prev, photoUrl]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.aluno_id) {
        toast.error("Selecione um aluno");
        return;
      }

      const metricsObj = metrics.reduce((acc, metric) => {
        if (metric.nome && metric.valor) {
          acc[metric.nome] = metric.valor;
        }
        return acc;
      }, {} as Record<string, string>);

      const reportData = {
        coach_id: user?.id,
        titulo: formData.titulo,
        aluno_id: formData.aluno_id,
        periodo_inicio: format(formData.periodo_inicio, "yyyy-MM-dd"),
        periodo_fim: format(formData.periodo_fim, "yyyy-MM-dd"),
        observacoes: formData.observacoes,
        metricas: metricsObj,
      };

      let currentReportId = reportId;

      if (reportId) {
        const { error } = await supabase
          .from("relatorios")
          .update(reportData)
          .eq("id", reportId);

        if (error) throw error;

        // Delete existing photos and re-insert selected ones
        await supabase
          .from("relatorio_midias")
          .delete()
          .eq("relatorio_id", reportId);
      } else {
        const { data, error } = await supabase
          .from("relatorios")
          .insert(reportData)
          .select()
          .single();

        if (error) throw error;
        currentReportId = data.id;
      }

      // Insert selected photos
      if (selectedPhotos.length > 0 && currentReportId) {
        const photoData = selectedPhotos.map((url, index) => ({
          relatorio_id: currentReportId,
          tipo: "imagem",
          url: url,
          ordem: index,
          legenda: alunoPhotos.find(p => p.url === url)?.descricao || null,
        }));

        const { error: photoError } = await supabase
          .from("relatorio_midias")
          .insert(photoData);

        if (photoError) throw photoError;
      }

      toast.success(reportId ? "Relatório atualizado com sucesso!" : "Relatório criado com sucesso!");
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar relatório: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="titulo">Título do Relatório *</Label>
          <Input
            id="titulo"
            value={formData.titulo}
            onChange={(e) =>
              setFormData({ ...formData, titulo: e.target.value })
            }
            placeholder="Ex: Relatório Mensal - Janeiro 2024"
            required
          />
        </div>

        <div>
          <Label htmlFor="aluno">Aluno *</Label>
          <Select
            value={formData.aluno_id}
            onValueChange={(value) =>
              setFormData({ ...formData, aluno_id: value })
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um aluno" />
            </SelectTrigger>
            <SelectContent>
              {alunos.map((aluno) => (
                <SelectItem key={aluno.id} value={aluno.id}>
                  {aluno.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Período Início *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.periodo_inicio, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.periodo_inicio}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, periodo_inicio: date })
                  }
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Período Fim *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.periodo_fim, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.periodo_fim}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, periodo_fim: date })
                  }
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Métricas de Desempenho</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addMetric}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Métrica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="flex gap-2">
              <Input
                placeholder="Nome da métrica"
                value={metric.nome}
                onChange={(e) => updateMetric(metric.id, "nome", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Valor"
                value={metric.valor}
                onChange={(e) => updateMetric(metric.id, "valor", e.target.value)}
                className="w-32"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => removeMetric(metric.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Label htmlFor="observacoes">Observações e Feedback</Label>
        <Textarea
          id="observacoes"
          value={formData.observacoes}
          onChange={(e) =>
            setFormData({ ...formData, observacoes: e.target.value })
          }
          placeholder="Descreva observações sobre o desempenho, evolução, pontos de atenção..."
          rows={6}
        />
      </div>

      {formData.aluno_id && alunoPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Anexar Fotos do Aluno ({selectedPhotos.length} selecionadas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {alunoPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group cursor-pointer"
                  onClick={() => togglePhotoSelection(photo.url)}
                >
                  <div className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedPhotos.includes(photo.url)
                      ? "border-primary shadow-lg"
                      : "border-border hover:border-primary/50"
                  }`}>
                    <img
                      src={photo.url}
                      alt={photo.descricao || "Foto do aluno"}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={selectedPhotos.includes(photo.url)}
                        onCheckedChange={() => togglePhotoSelection(photo.url)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  {photo.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {photo.descricao}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(photo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} variant="premium">
          {loading ? "Salvando..." : reportId ? "Atualizar" : "Criar Relatório"}
        </Button>
      </div>
    </form>
  );
};

export default ReportForm;
