import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
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
import { CalendarIcon, Image } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import StudentProgressDashboard from "@/components/student/StudentProgressDashboard";

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
    const result = await apiClient.requestSafe<any[]>('/api/alunos');
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    const filtrados = data
      .filter(a => a.coach_id === user?.id)
      .sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
    setAlunos(filtrados);
    if (!result.success) {
      toast.error("Erro ao carregar alunos: " + result.error);
    }
  };

  const loadAlunoPhotos = async () => {
    if (!formData.aluno_id) return;

    const result = await apiClient.requestSafe<any[]>(`/api/fotos-alunos?aluno_id=${formData.aluno_id}`);
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    const ordenadas = data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    setAlunoPhotos(ordenadas);
    if (!result.success) {
      toast.error("Erro ao carregar fotos: " + result.error);
    }
  };

  const loadReport = async () => {
    if (!reportId) return;

    const reportResult = await apiClient.requestSafe<any>(`/api/relatorios/${reportId}`);
    const relatorio = reportResult.success ? reportResult.data : null;
    
    if (!relatorio) {
      toast.error("Relatório não encontrado");
      return;
    }

    setFormData({
      titulo: relatorio.titulo,
      aluno_id: relatorio.aluno_id,
      periodo_inicio: new Date(relatorio.periodo_inicio),
      periodo_fim: new Date(relatorio.periodo_fim),
      observacoes: relatorio.observacoes || "",
    });

    const midiasResult = await apiClient.requestSafe<any[]>(`/api/relatorio-midias?relatorio_id=${reportId}`);
    const midias = midiasResult.success && Array.isArray(midiasResult.data) ? midiasResult.data : [];
    setSelectedPhotos(midias.map(m => m.url));
    if (!midiasResult.success) {
      toast.error("Erro ao carregar mídias: " + midiasResult.error);
    }
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

    if (!formData.aluno_id) {
      toast.error("Selecione um aluno");
      setLoading(false);
      return;
    }

    const reportData = {
      coach_id: user?.id,
      titulo: formData.titulo,
      aluno_id: formData.aluno_id,
      periodo_inicio: format(formData.periodo_inicio, "yyyy-MM-dd"),
      periodo_fim: format(formData.periodo_fim, "yyyy-MM-dd"),
      observacoes: formData.observacoes,
    };

    let currentReportId = reportId;

    if (reportId) {
      const updateResult = await apiClient.requestSafe(`/api/relatorios/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify(reportData),
      });
      if (!updateResult.success) {
        toast.error("Erro ao salvar relatório: " + updateResult.error);
        setLoading(false);
        return;
      }

      await apiClient.requestSafe(`/api/relatorio-midias?relatorio_id=${reportId}`, { method: 'DELETE' });
    } else {
      const createResult = await apiClient.requestSafe<any>('/api/relatorios', {
        method: 'POST',
        body: JSON.stringify(reportData),
      });

      const relatorio = createResult.success ? createResult.data : null;
      if (!relatorio?.id) {
        toast({
          title: "Erro",
          description: "Erro ao criar relatório. Tente novamente.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      currentReportId = relatorio.id;
    }

    if (selectedPhotos.length > 0 && currentReportId) {
      for (let index = 0; index < selectedPhotos.length; index++) {
        const url = selectedPhotos[index];
        await apiClient.requestSafe('/api/relatorio-midias', {
          method: 'POST',
          body: JSON.stringify({
            relatorio_id: currentReportId,
            tipo: "foto",
            url: url,
            ordem: index,
            legenda: alunoPhotos.find(p => p.url === url)?.descricao || null,
          }),
        });
      }
    }

    toast.success(reportId ? "Relatório atualizado com sucesso!" : "Relatório criado com sucesso!");
    onSuccess();
    setLoading(false);
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

      {/* Dashboard de Progresso */}
      {formData.aluno_id && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso do Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentProgressDashboard studentId={formData.aluno_id} />
          </CardContent>
        </Card>
      )}

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
              {alunoPhotos.map((photo) => {
                const isSelected = selectedPhotos.includes(photo.url);
                return (
                  <div
                    key={photo.id}
                    className="relative group cursor-pointer"
                    onClick={() => togglePhotoSelection(photo.url)}
                  >
                    <div className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected
                        ? "border-primary shadow-lg"
                        : "border-border hover:border-primary/50"
                    }`}>
                      <img
                        src={photo.url}
                        alt={photo.descricao || "Foto do aluno"}
                        className="w-full h-32 object-cover"
                      />
                      <div 
                        className="absolute top-2 right-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
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
                );
              })}
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
