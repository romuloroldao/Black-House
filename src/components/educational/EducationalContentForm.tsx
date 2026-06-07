import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import {
  EDUCATIONAL_CONTENT_CATEGORIES,
  EDUCATIONAL_CONTENT_TYPES,
  EDUCATIONAL_CONTENT_TYPE_LABELS,
  type EducationalContent,
  type EducationalContentType,
} from "@/lib/educational-content";

interface Props {
  initial: EducationalContent | null;
  onCancel: () => void;
  onSaved: () => void;
}

const EducationalContentForm = ({ initial, onCancel, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Refeição Livre");
  const [contentType, setContentType] = useState<EducationalContentType>(
    initial?.content_type ?? "pdf",
  );
  const [fileUrl, setFileUrl] = useState(initial?.file_url ?? "");
  const [articleContent, setArticleContent] = useState(initial?.article_content ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const handlePdfUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = apiClient.getToken();
      const base = (import.meta.env.VITE_API_URL || "https://api.blackhouse.app.br").replace(/\/$/, "");
      const res = await fetch(`${base}/api/uploads/educational-pdf`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no upload");
      setFileUrl(data.url || data.path);
      toast({ title: "PDF enviado com sucesso" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Título é obrigatório" });
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      content_type: contentType,
      file_url: contentType === "pdf" ? fileUrl.trim() || null : null,
      article_content: contentType === "article" ? articleContent.trim() || null : null,
      video_url: contentType === "video" ? videoUrl.trim() || null : null,
      active,
    };

    setSaving(true);
    const result = initial
      ? await apiClient.requestSafe(`/api/educational-contents/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      : await apiClient.requestSafe("/api/educational-contents", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    setSaving(false);

    if (!result.success) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: result.error });
      return;
    }

    toast({ title: initial ? "Conteúdo atualizado" : "Conteúdo criado" });
    onSaved();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Button variant="ghost" onClick={onCancel} className="gap-2 px-0">
        <ArrowLeft className="h-4 w-4" />
        Voltar à lista
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{initial ? "Editar conteúdo" : "Novo conteúdo educativo"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATIONAL_CONTENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select
                value={contentType}
                onValueChange={(v) => setContentType(v as EducationalContentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATIONAL_CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EDUCATIONAL_CONTENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {contentType === "pdf" && (
            <div className="space-y-2">
              <Label>PDF</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePdfUpload(f);
                  }}
                  disabled={uploading}
                />
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </div>
              {fileUrl ? (
                <p className="text-xs text-muted-foreground break-all">
                  <Upload className="mr-1 inline h-3 w-3" />
                  {fileUrl}
                </p>
              ) : null}
            </div>
          )}

          {contentType === "article" && (
            <div className="space-y-2">
              <Label htmlFor="article">Conteúdo do artigo</Label>
              <Textarea
                id="article"
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                rows={12}
                placeholder="Texto educativo para o aluno..."
              />
            </div>
          )}

          {contentType === "video" && (
            <div className="space-y-2">
              <Label htmlFor="videoUrl">URL do vídeo (YouTube ou link externo)</Label>
              <Input
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch id="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">Conteúdo ativo</Label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleSubmit} disabled={saving || uploading} className="sm:flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EducationalContentForm;
