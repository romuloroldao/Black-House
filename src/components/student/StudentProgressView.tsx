import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Camera,
  Trash2,
  Activity,
  TrendingUp,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import { confirmDelete, useConfirm } from "@/contexts/ConfirmContext";
import StudentProgressDashboard from "./StudentProgressDashboard";
import CheckinStreakCard from "@/components/student/today/CheckinStreakCard";
import ProgressPhotoUploadDialog from "@/components/student/progress/ProgressPhotoUploadDialog";
import { useAlunoHoje } from "@/hooks/useAlunoHoje";
import { useSearchParams } from "react-router-dom";
import { formatPhotoAgeLabel } from "@/lib/photo-evolution-utils";

type FotoAluno = {
  id: string;
  url: string;
  descricao?: string | null;
  created_at: string;
};

const StudentProgressView = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: hoje, loading: hojeLoading } = useAlunoHoje(Boolean(user));
  const [fotos, setFotos] = useState<FotoAluno[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [descricao, setDescricao] = useState("");

  const sectionParam = searchParams.get("section");
  const focusFotos = searchParams.get("focus") === "fotos";
  const uploadParam = searchParams.get("upload") === "1";

  const defaultTab = useMemo(() => {
    if (sectionParam === "metrics") return "metrics";
    if (sectionParam === "photos" || focusFotos || uploadParam) return "photos";
    if (!dataLoaded) return "photos";
    return fotos.length === 0 ? "photos" : "metrics";
  }, [sectionParam, focusFotos, uploadParam, dataLoaded, fotos.length]);

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (user) loadProgressData();
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!uploadParam) return;
    setActiveTab("photos");
    setIsUploadOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });
  }, [uploadParam, searchParams, setSearchParams]);

  const loadProgressData = async () => {
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (aluno) {
      setAlunoId(aluno.id);
      const fotosResult = await apiClient.requestSafe<FotoAluno[]>(
        `/api/fotos-alunos?aluno_id=${aluno.id}`,
      );
      const fotosData =
        fotosResult.success && Array.isArray(fotosResult.data) ? fotosResult.data : [];
      const ordenadas = fotosData.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      setFotos(ordenadas);
    }
    setDataLoaded(true);
  };

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const resetUploadDialog = () => {
    clearPreview();
    setDescricao("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreparingImage(true);
    try {
      const prepared = await prepareImageForUpload(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível usar esta foto");
      clearPreview();
    } finally {
      setPreparingImage(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !alunoId) {
      toast.error("Selecione ou tire uma foto antes de enviar");
      return;
    }

    setUploading(true);
    try {
      const uploadResult = await apiClient.uploadFile(
        "progress-photos",
        `${alunoId}/${selectedFile.name}`,
        selectedFile,
      );
      const publicUrl =
        uploadResult?.url ||
        apiClient.getPublicUrl("progress-photos", `${alunoId}/${selectedFile.name}`);

      const createResult = await apiClient.requestSafe("/api/fotos-alunos", {
        method: "POST",
        body: JSON.stringify({
          aluno_id: alunoId,
          url: publicUrl,
          descricao: descricao || null,
        }),
      });

      if (!createResult.success) {
        toast.error(createResult.error || "Erro ao registar a foto");
        return;
      }

      toast.success("Foto enviada! O seu coach vê na sua ficha.");
      setIsUploadOpen(false);
      resetUploadDialog();
      loadProgressData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar foto";
      toast.error(
        msg.includes("fetch") ? "Falha de conexão. Verifique a internet e tente de novo." : msg,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (foto: FotoAluno) => {
    if (
      !(await confirmDelete(confirm, "Esta foto de evolução será removida permanentemente."))
    ) {
      return;
    }

    const deleteResult = await apiClient.requestSafe(`/api/fotos-alunos/${foto.id}`, {
      method: "DELETE",
    });
    if (!deleteResult.success) {
      toast.error(deleteResult.error || "Erro ao excluir foto");
      return;
    }

    toast.success("Foto excluída");
    loadProgressData();
  };

  const ultimaFoto = fotos[0] ?? null;
  const openMetrics = () => {
    setActiveTab("metrics");
    const next = new URLSearchParams(searchParams);
    next.set("tab", "progress");
    next.set("section", "metrics");
    setSearchParams(next);
  };

  const uploadTrigger = (
    <Button className="w-full min-h-11 sm:w-auto" size="lg">
      <Camera className="mr-2 h-4 w-4" />
      {fotos.length === 0 ? "Tirar primeira foto" : "Tirar foto"}
    </Button>
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Fotos e evolução</h1>
        <p className="mt-1 text-muted-foreground">
          Registe o seu físico para o coach e acompanhe métricas semanais
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 w-full">
        <TabsList className="grid h-auto w-full min-w-0 max-w-full grid-cols-2 gap-1 sm:max-w-md">
          <TabsTrigger value="photos" className="flex items-center gap-2 min-h-11">
            <Camera className="h-4 w-4" />
            Fotos
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2 min-h-11">
            <Activity className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-6 space-y-6">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="space-y-4 p-5">
              <div className="flex gap-4">
                {ultimaFoto ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
                    <img
                      src={ultimaFoto.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/10">
                    <Camera className="h-8 w-8 text-primary" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Fotos de evolução</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ultimaFoto
                      ? `${formatPhotoAgeLabel(ultimaFoto.created_at)} · ${fotos.length} foto${fotos.length === 1 ? "" : "s"} no total`
                      : "Uma foto por semana ajuda o coach a ajustar dieta e treino na sua ficha."}
                  </p>
                </div>
              </div>

              <ProgressPhotoUploadDialog
                open={isUploadOpen}
                onOpenChange={setIsUploadOpen}
                trigger={uploadTrigger}
                uploading={uploading}
                preparingImage={preparingImage}
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                descricao={descricao}
                onDescricaoChange={setDescricao}
                onFileSelect={handleFileSelect}
                onUpload={handleUpload}
                onCancel={resetUploadDialog}
              />
            </CardContent>
          </Card>

          {fotos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5" />
                  Galeria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {fotos.map((foto) => (
                    <Card key={foto.id} className="group relative overflow-hidden">
                      <div className="relative aspect-square bg-muted">
                        <img
                          src={foto.url}
                          alt={foto.descricao || "Foto de evolução"}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute right-2 top-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-9 w-9"
                            aria-label="Excluir foto"
                            onClick={() => handleDeletePhoto(foto)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        {foto.descricao && (
                          <p className="mb-1 text-sm line-clamp-2">{foto.descricao}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(foto.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
                <Camera className="h-14 w-14 text-muted-foreground/80" aria-hidden />
                <div>
                  <p className="font-medium">Ainda sem fotos</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                    Tire uma foto agora — o seu coach vê na ficha do aluno e consegue acompanhar a
                    evolução ao longo das semanas.
                  </p>
                </div>
                <Button className="min-h-11" onClick={() => setIsUploadOpen(true)}>
                  <Camera className="mr-2 h-4 w-4" />
                  Tirar primeira foto
                </Button>
              </CardContent>
            </Card>
          )}

          <button
            type="button"
            onClick={openMetrics}
            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 font-medium">
              <BarChart3 className="h-4 w-4 text-primary" />
              Ver métricas semanais
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6 space-y-6">
          <CheckinStreakCard
            loading={hojeLoading}
            streak={hoje?.checkin_streak ?? null}
            checkinDue={hoje?.contadores?.checkin_due}
            onOpenCheckin={() => setSearchParams({ tab: "checkin" })}
          />
          <StudentProgressDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProgressView;
