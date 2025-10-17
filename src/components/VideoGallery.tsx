import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Filter, 
  Video, 
  Play, 
  Clock, 
  Users, 
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Youtube,
  Calendar,
  Star,
  Heart,
  Share2
} from "lucide-react";
import VideoForm from "./VideoForm";
import LiveManager from "./LiveManager";

const VideoGallery = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("videos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoToWatch, setVideoToWatch] = useState<any>(null);

  useEffect(() => {
    carregarVideos();
  }, []);

  const carregarVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const videosFormatados = data?.map(video => ({
        id: video.id,
        title: video.titulo,
        description: video.descricao || '',
        youtubeId: video.youtube_id,
        thumbnail: `https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`,
        duration: video.duracao || '0:00',
        category: video.categoria,
        visibility: video.visibilidade,
        tags: video.tags || [],
        uploadDate: new Date(video.created_at).toISOString().split('T')[0],
        views: video.views,
        likes: video.likes,
        instructor: video.instrutor || 'Instrutor',
        isFavorited: false // TODO: implementar favoritos quando houver usuário
      })) || [];

      setVideos(videosFormatados);
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: "all", label: "Todos", count: videos.length },
    { id: "Técnica", label: "Técnica", count: videos.filter(v => v.category === "Técnica").length },
    { id: "Cardio", label: "Cardio", count: videos.filter(v => v.category === "Cardio").length },
    { id: "Mobilidade", label: "Mobilidade", count: videos.filter(v => v.category === "Mobilidade").length },
    { id: "Força", label: "Força", count: videos.filter(v => v.category === "Força").length }
  ];

  const visibilityLabels = {
    "active-students": { label: "Alunos Ativos", color: "bg-primary/10 text-primary border-primary/20", icon: Users },
    "inactive-students": { label: "Alunos Inativos", color: "bg-warning/10 text-warning border-warning/20", icon: Users },
    "guests": { label: "Convidados", color: "bg-accent/10 text-accent border-accent/20", icon: Eye },
    "everyone": { label: "Público", color: "bg-primary/10 text-primary border-primary/20", icon: Eye }
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         video.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || video.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleEditVideo = (video: any) => {
    setSelectedVideo(video);
    setShowVideoForm(true);
  };

  const handleCreateNew = () => {
    setSelectedVideo(null);
    setShowVideoForm(true);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Tem certeza que deseja deletar este vídeo?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast({
        title: "Vídeo deletado!",
        description: "O vídeo foi removido com sucesso.",
      });

      carregarVideos();
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o vídeo.",
        variant: "destructive",
      });
    }
  };

  const renderVideoCard = (video: any) => {
    const visibilityInfo = visibilityLabels[video.visibility as keyof typeof visibilityLabels];
    const VisibilityIcon = visibilityInfo.icon;

    return (
      <Card key={video.id} className="group hover:shadow-elevated transition-smooth overflow-hidden">
        <div className="relative">
          {/* Thumbnail */}
          <div className="aspect-video bg-muted relative overflow-hidden">
            <img 
              src={video.thumbnail} 
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
              <Button size="lg" className="rounded-full" onClick={() => setVideoToWatch(video)}>
                <Play className="w-6 h-6 mr-2" />
                Assistir
              </Button>
            </div>
            
            {/* Duration */}
            <Badge className="absolute bottom-2 right-2 bg-black/80 text-white border-none">
              {video.duration}
            </Badge>

            {/* Favorite */}
            {video.isFavorited && (
              <div className="absolute top-2 right-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
            )}
          </div>
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2 mb-2">{video.title}</CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                {video.description}
              </CardDescription>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEditVideo(video)}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleDeleteVideo(video.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {video.tags.slice(0, 3).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {video.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{video.tags.length - 3}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{video.views}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{video.likes}</span>
                </div>
              </div>
              
              <Badge className={visibilityInfo.color} variant="outline">
                <VisibilityIcon className="w-3 h-3 mr-1" />
                {visibilityInfo.label}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {video.instructor} • {new Date(video.uploadDate).toLocaleDateString('pt-BR')}
              </span>
              <Button variant="outline" size="sm" className="h-8">
                <Youtube className="w-3 h-3 mr-1" />
                YouTube
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showVideoForm) {
    return (
      <VideoForm 
        video={selectedVideo}
        onBack={() => setShowVideoForm(false)}
        onSave={() => {
          setShowVideoForm(false);
          carregarVideos();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Video Player Dialog */}
      <Dialog open={!!videoToWatch} onOpenChange={() => setVideoToWatch(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{videoToWatch?.title}</DialogTitle>
            <DialogDescription>{videoToWatch?.description}</DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoToWatch?.youtubeId}?autoplay=1`}
              title={videoToWatch?.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Galeria de Vídeos
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus vídeos do YouTube com controle de acesso
          </p>
        </div>
        <Button onClick={handleCreateNew} className="shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Novo Vídeo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="videos">Galeria de Vídeos</TabsTrigger>
          <TabsTrigger value="lives">Lives YouTube</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar vídeos por título, descrição ou tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" className="shrink-0">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros Avançados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="shrink-0"
              >
                {category.label}
                <Badge variant="secondary" className="ml-2 h-4 w-auto px-1.5 text-xs">
                  {category.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Video className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{videos.length}</p>
                    <p className="text-xs text-muted-foreground">Total Vídeos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{videos.reduce((acc, v) => acc + v.views, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Visualizações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{videos.reduce((acc, v) => acc + v.likes, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Curtidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{videos.filter(v => v.isFavorited).length}</p>
                    <p className="text-xs text-muted-foreground">Favoritos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Videos Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredVideos.map(renderVideoCard)}
          </div>

          {/* Empty State */}
          {filteredVideos.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum vídeo encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Tente ajustar sua busca ou adicione novos vídeos do YouTube.
                </p>
                <Button onClick={handleCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Primeiro Vídeo
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="lives">
          <LiveManager />
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
};

export default VideoGallery;