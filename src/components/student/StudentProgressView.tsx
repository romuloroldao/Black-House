import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Upload, Loader2, Trash2, Activity, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import StudentProgressDashboard from "./StudentProgressDashboard";
import StudentProgressSummary from "./StudentProgressSummary";

const StudentProgressView = () => {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [fotos, setFotos] = useState<any[]>([]);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [tab, setTab] = useState("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadProgressData();
  }, [user]);

  const loadProgressData = async () => {
    try {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("id")
        .eq("email", user?.email)
        .maybeSingle();

      if (aluno) {
        setAlunoId(aluno.id);
        const { data: fotosData } = await supabase
          .from("fotos_alunos")
          .select("*")
          .eq("aluno_id", aluno.id)
          .order("created_at", { ascending: false });
        setFotos(fotosData || []);
      }
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Tipo de arquivo inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5242880) {
      toast.error("Arquivo muito grande. Tamanho máximo: 5MB");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !alunoId) {
      toast.error("Selecione uma foto antes de fazer upload");
      return;
    }
    try {
      setUploading(true);
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${alunoId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("progress-photos")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("fotos_alunos").insert({
        aluno_id: alunoId,
        url: urlData.publicUrl,
        descricao: descricao || null,
      });
      if (dbError) throw dbError;

      toast.success("Foto enviada com sucesso!");
      setIsUploadOpen(false);
      setSelectedFile(null);
      setDescricao("");
      loadProgressData();
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error(error.message || "Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (foto: any) => {
    if (!confirm("Tem certeza que deseja excluir esta foto?")) return;
    try {
      const url = new URL(foto.url);
      const pathParts = url.pathname.split("/");
      const filePath = pathParts
        .slice(pathParts.indexOf("progress-photos") + 1)
        .join("/");

      const { error: storageError } = await supabase.storage
        .from("progress-photos")
        .remove([filePath]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("fotos_alunos")
        .delete()
        .eq("id", foto.id);
      if (dbError) throw dbError;

      toast.success("Foto excluída com sucesso!");
      loadProgressData();
    } catch (error: any) {
      console.error("Erro ao deletar foto:", error);
      toast.error(error.message || "Erro ao excluir foto");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Meu Progresso</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Score da semana, tendência e fotos — com dados reais do check-in
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2.5">
            <TrendingUp className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs sm:text-sm py-2.5">
            <Activity className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="photos" className="text-xs sm:text-sm py-2.5">
            <Camera className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Fotos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <StudentProgressSummary
            onGoCheckin={() => setSearchParams({ tab: "checkin" })}
            onShowDetails={() => setTab("metrics")}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <StudentProgressDashboard />
        </TabsContent>

        <TabsContent value="photos" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5" />
                Fotos de progresso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Registre sua evolução com fotos ao longo do tempo
              </p>

              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto min-h-[44px]">
                    <Camera className="mr-2 h-4 w-4" />
                    Adicionar foto
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Enviar foto de progresso</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Foto</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-[44px]"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {selectedFile ? selectedFile.name : "Escolher arquivo"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou WEBP — máximo 5MB
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descricao">Descrição (opcional)</Label>
                      <Textarea
                        id="descricao"
                        placeholder="Ex: Progresso após 2 meses"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => {
                        setIsUploadOpen(false);
                        setSelectedFile(null);
                        setDescricao("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="min-h-[44px]"
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {fotos.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {fotos.map((foto) => (
                <Card key={foto.id} className="overflow-hidden relative">
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={foto.url}
                      alt={foto.descricao || "Foto de progresso"}
                      className="w-full h-full object-cover"
                    />
                    {/* Sempre visível no touch — sem hover */}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 min-h-[44px] min-w-[44px]"
                      onClick={() => handleDeletePhoto(foto)}
                      aria-label="Excluir foto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-3">
                    {foto.descricao && (
                      <p className="text-sm mb-1">{foto.descricao}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(foto.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center text-sm">
                  Nenhuma foto ainda.
                  <br />
                  Comece a registrar sua evolução.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProgressView;
