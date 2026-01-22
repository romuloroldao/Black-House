import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Search, Clock } from "lucide-react";

const StudentVideosView = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [coachId, setCoachId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadVideos();
    }
  }, [user]);

  const loadVideos = async () => {
    try {
      // DESIGN-ALUNO-CANONICO-MIGRATION-006: Usar rota canônica GET /api/alunos/me
      const aluno = await apiClient.getMe();

      if (aluno?.coach_id) {
        setCoachId(aluno.coach_id);

        // Buscar vídeos do coach (visibilidade: públicos ou para alunos)
        // Nota: .in() pode não estar implementado, então vamos buscar todos e filtrar
        const videosData = await apiClient
          .from("videos")
          .select("*")
          .eq("coach_id", aluno.coach_id)
          .order("created_at", { ascending: false });

        // Filtrar por visibilidade no cliente
        // Schema permite: 'active-students', 'inactive-students', 'guests', 'everyone'
        // Alunos podem ver: 'everyone' (todos) e 'active-students' (alunos ativos)
        // NOTA: "todos" e "alunos" não existem no schema, apenas "everyone"
        const visibilidadesPermitidas = ["everyone", "active-students"];
        const videosFiltrados = Array.isArray(videosData) 
          ? videosData.filter(v => visibilidadesPermitidas.includes(v.visibilidade))
          : [];

        console.log('VIDEOS-01: Carregando vídeos', {
          totalVideos: Array.isArray(videosData) ? videosData.length : 0,
          videosFiltrados: videosFiltrados.length,
          coachId: aluno.coach_id,
          visibilidadesEncontradas: Array.isArray(videosData) 
            ? [...new Set(videosData.map(v => v.visibilidade))]
            : []
        });

        setVideos(videosFiltrados);
      }
    } catch (error) {
      console.error("Erro ao carregar vídeos:", error);
    }
  };

  const filteredVideos = videos.filter(video =>
    video.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Galeria de Vídeos</h1>
        <p className="text-muted-foreground">
          Acesse conteúdos exclusivos do seu coach
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar vídeos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredVideos.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum vídeo disponível</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Nenhum vídeo encontrado com esse termo" : "Aguarde novos conteúdos do seu coach"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="shadow-card hover:shadow-glow transition-shadow cursor-pointer group">
              <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
                <img
                  src={`https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`}
                  alt={video.titulo}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    e.currentTarget.src = `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-12 w-12 text-white" />
                </div>
                {video.duracao && (
                  <Badge variant="default" className="absolute bottom-2 right-2">
                    <Clock className="h-3 w-3 mr-1" />
                    {video.duracao}
                  </Badge>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2 line-clamp-2">{video.titulo}</h3>
                {video.descricao && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {video.descricao}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{video.categoria}</Badge>
                  {video.tags && video.tags.slice(0, 2).map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentVideosView;
