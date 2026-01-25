import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Upload, Loader2, Trash2, Activity, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import StudentProgressDashboard from "./StudentProgressDashboard";

const StudentProgressView = () => {
  const { user } = useAuth();
  const [fotos, setFotos] = useState<any[]>([]);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadProgressData();
    }
  }, [user]);

  const loadProgressData = async () => {
    const alunoResult = await apiClient.getMeSafe();
    const aluno = alunoResult.success ? alunoResult.data : null;

    if (aluno) {
      setAlunoId(aluno.id);

      const fotosResult = await apiClient.requestSafe<any[]>(`/api/fotos-alunos?aluno_id=${aluno.id}`);
      const fotosData = fotosResult.success && Array.isArray(fotosResult.data) ? fotosResult.data : [];
      const ordenadas = fotosData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setFotos(ordenadas);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !alunoId) {
      toast.error("Selecione uma foto antes de fazer upload");
      return;
    }

    setUploading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${alunoId}/${fileName}`;

    await apiClient.uploadFile("progress-photos", filePath, selectedFile);
    const publicUrl = apiClient.getPublicUrl("progress-photos", filePath);

    const createResult = await apiClient.requestSafe('/api/fotos-alunos', {
      method: 'POST',
      body: JSON.stringify({
        aluno_id: alunoId,
        url: publicUrl,
        descricao: descricao || null,
      }),
    });

    if (!createResult.success) {
      toast.error(createResult.error || "Erro ao fazer upload da foto");
      setUploading(false);
      return;
    }

    toast.success("Foto enviada com sucesso!");
    setIsUploadOpen(false);
    setSelectedFile(null);
    setDescricao("");
    loadProgressData();
    setUploading(false);
  };

  const handleDeletePhoto = async (foto: any) => {
    if (!confirm("Tem certeza que deseja excluir esta foto?")) {
      return;
    }

    const url = new URL(foto.url);
    const pathParts = url.pathname.split("/");
    const filePath = pathParts.slice(pathParts.indexOf("progress-photos") + 1).join("/");

    const deleteResult = await apiClient.requestSafe(`/api/fotos-alunos/${foto.id}`, { method: 'DELETE' });
    if (!deleteResult.success) {
      toast.error(deleteResult.error || "Erro ao excluir foto");
      return;
    }

    toast.success("Foto excluída com sucesso!");
    loadProgressData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meu Progresso</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe sua evolução através de métricas semanais e fotos
          </p>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Métricas Semanais
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Evolução Fotográfica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-6">
          <StudentProgressDashboard />
        </TabsContent>

        <TabsContent value="photos" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Fotos de Progresso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Registre suas conquistas através de fotos ao longo do tempo
              </p>

              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Camera className="mr-2 h-4 w-4" />
                    Adicionar Foto de Progresso
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar Foto de Progresso</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Foto</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {selectedFile ? selectedFile.name : "Escolher arquivo"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou WEBP - Máximo 5MB
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descricao">Descrição (opcional)</Label>
                      <Textarea
                        id="descricao"
                        placeholder="Ex: Progresso após 2 meses de treino"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsUploadOpen(false);
                        setSelectedFile(null);
                        setDescricao("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
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
                          Enviar Foto
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {fotos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Galeria de Fotos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {fotos.map((foto) => (
                    <Card key={foto.id} className="overflow-hidden group relative">
                      <div className="aspect-square bg-muted relative">
                        <img
                          src={foto.url}
                          alt={foto.descricao || "Foto de progresso"}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDeletePhoto(foto)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        {foto.descricao && (
                          <p className="text-sm mb-2">{foto.descricao}</p>
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
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Nenhuma foto de progresso ainda.
                  <br />
                  Comece a registrar sua evolução!
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
