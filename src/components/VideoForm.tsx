import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Save, 
  Youtube, 
  Eye,
  Users,
  Plus,
  X,
  ExternalLink,
  CheckCircle2
} from "lucide-react";

interface VideoFormProps {
  video?: any;
  onBack: () => void;
  onSave: () => void;
}

const VideoForm = ({ video, onBack, onSave }: VideoFormProps) => {
  const [formData, setFormData] = useState({
    title: video?.title || "",
    description: video?.description || "",
    youtubeUrl: video?.youtubeUrl || "",
    youtubeId: video?.youtubeId || "",
    category: video?.category || "",
    visibility: video?.visibility || "active-students",
    tags: video?.tags || [],
    thumbnail: video?.thumbnail || "",
    duration: video?.duration || "",
    isActive: video?.isActive ?? true
  });

  const [newTag, setNewTag] = useState("");
  const [youtubeData, setYoutubeData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const categories = [
    "Técnica",
    "Cardio", 
    "Força",
    "Mobilidade",
    "Funcional",
    "Reabilitação",
    "Nutrição",
    "Motivacional"
  ];

  const visibilityOptions = [
    { value: "active-students", label: "Alunos Ativos", description: "Apenas alunos com planos ativos" },
    { value: "inactive-students", label: "Alunos Inativos", description: "Alunos com planos vencidos" },
    { value: "guests", label: "Convidados", description: "Visitantes e prospects" },
    { value: "everyone", label: "Público", description: "Todos os usuários" }
  ];

  // Função para extrair ID do YouTube da URL
  const extractYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Função para validar URL do YouTube
  const validateYouTubeUrl = async (url: string) => {
    setIsValidating(true);
    
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      setIsValidating(false);
      return;
    }

    // Simular validação da API do YouTube (seria uma chamada real para o backend)
    setTimeout(() => {
      const mockData = {
        id: videoId,
        title: "Vídeo do YouTube Importado",
        description: "Descrição automática importada do YouTube",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: "10:30"
      };
      
      setYoutubeData(mockData);
      setFormData(prev => ({
        ...prev,
        youtubeId: videoId,
        title: prev.title || mockData.title,
        description: prev.description || mockData.description,
        thumbnail: mockData.thumbnail,
        duration: mockData.duration
      }));
      setIsValidating(false);
    }, 1500);
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, youtubeUrl: url });
    
    if (url) {
      validateYouTubeUrl(url);
    } else {
      setYoutubeData(null);
      setFormData(prev => ({
        ...prev,
        youtubeId: "",
        thumbnail: "",
        duration: ""
      }));
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSave = () => {
    // Aqui faria a validação e salvaria no Supabase
    console.log("Salvando vídeo:", formData);
    onSave();
  };

  const selectedVisibility = visibilityOptions.find(opt => opt.value === formData.visibility);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {video ? "Editar Vídeo" : "Novo Vídeo"}
          </h1>
          <p className="text-muted-foreground">
            {video ? "Modifique as informações do vídeo" : "Adicione um novo vídeo do YouTube"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="shadow-glow">
            <Save className="w-4 h-4 mr-2" />
            Salvar Vídeo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* URL do YouTube */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                Link do YouTube
              </CardTitle>
              <CardDescription>
                Cole o link do vídeo do YouTube para importar automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">URL do YouTube</Label>
                <div className="flex gap-2">
                  <Input
                    id="youtube-url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={formData.youtubeUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                  />
                  {formData.youtubeUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={formData.youtubeUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
                
                {isValidating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Validando vídeo do YouTube...
                  </div>
                )}
                
                {youtubeData && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="w-4 h-4" />
                    Vídeo importado com sucesso!
                  </div>
                )}
              </div>

              {/* Preview do vídeo */}
              {formData.thumbnail && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={formData.thumbnail} 
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações do Vídeo */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Vídeo</CardTitle>
              <CardDescription>
                Personalize as informações para sua plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Título do vídeo"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o conteúdo do vídeo..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button onClick={addTag} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurações de Acesso */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso</CardTitle>
              <CardDescription>
                Defina quem pode assistir este vídeo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Visibilidade</Label>
                <Select value={formData.visibility} onValueChange={(value) => setFormData({...formData, visibility: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visibilityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedVisibility && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {formData.visibility === 'everyone' ? <Eye className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    <span className="font-medium text-sm">{selectedVisibility.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedVisibility.description}
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Estatísticas de Acesso</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alunos Ativos</span>
                    <span className="font-medium">32</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alunos Inativos</span>
                    <span className="font-medium">8</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Convidados</span>
                    <span className="font-medium">5</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações Técnicas */}
          {formData.duration && (
            <Card>
              <CardHeader>
                <CardTitle>Informações Técnicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duração</span>
                  <span className="font-medium">{formData.duration}</span>
                </div>
                {formData.youtubeId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ID YouTube</span>
                    <span className="font-mono text-xs">{formData.youtubeId}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoForm;