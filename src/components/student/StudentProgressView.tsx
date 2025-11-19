import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
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

      const { error: dbError } = await supabase
        .from("fotos_alunos")
        .insert({
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
    if (!confirm("Tem certeza que deseja excluir esta foto?")) {
      return;
    }

    try {
      const url = new URL(foto.url);
      const pathParts = url.pathname.split("/");
      const filePath = pathParts.slice(pathParts.indexOf("progress-photos") + 1).join("/");

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
