import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Users, 
  Play, 
  Radio,
  Youtube,
  Edit3,
  Trash2,
  ExternalLink,
  Bell,
  Settings
} from "lucide-react";
import LiveForm from "./LiveForm";

const LiveManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [selectedLive, setSelectedLive] = useState(null);
  const [lives, setLives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLives();
  }, []);

  const carregarLives = async () => {
    try {
      const result = await apiClient.requestSafe<any[]>('/api/lives');
      const livesData = result.success && Array.isArray(result.data) ? result.data : [];
      const ordered = livesData.sort((a, b) => new Date(b.data_agendamento || 0).getTime() - new Date(a.data_agendamento || 0).getTime());
      const livesFormatadas = ordered.map(live => ({
        id: live.id,
        title: live.titulo,
        description: live.descricao || '',
        youtubeStreamKey: live.youtube_stream_key || '',
        scheduledDate: live.data_agendamento,
        scheduledTime: live.hora_agendamento,
        duration: live.duracao,
        status: live.status,
        visibility: live.visibilidade,
        registrations: live.num_inscricoes,
        maxParticipants: live.max_participantes,
        youtubeUrl: live.youtube_url || '',
        remindersEnabled: live.lembretes_ativados,
        autoRecord: live.auto_gravar,
        tags: live.tags || []
      }));

      setLives(livesFormatadas);
    } catch (error) {
      console.error('Erro ao carregar lives:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels = {
    scheduled: { label: "Agendada", color: "bg-warning/10 text-warning border-warning/20", icon: Calendar },
    live: { label: "Ao Vivo", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: Radio },
    ended: { label: "Finalizada", color: "bg-muted/10 text-muted-foreground border-muted/20", icon: Clock }
  };

  const visibilityLabels = {
    "active-students": { label: "Alunos Ativos", color: "bg-primary/10 text-primary border-primary/20" },
    "inactive-students": { label: "Alunos Inativos", color: "bg-warning/10 text-warning border-warning/20" },
    "guests": { label: "Convidados", color: "bg-accent/10 text-accent border-accent/20" },
    "everyone": { label: "Público", color: "bg-primary/10 text-primary border-primary/20" }
  };

  const filteredLives = lives.filter(live =>
    live.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    live.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    live.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEditLive = (live: any) => {
    setSelectedLive(live);
    setShowLiveForm(true);
  };

  const handleCreateNew = () => {
    setSelectedLive(null);
    setShowLiveForm(true);
  };

  const renderLiveCard = (live: any) => {
    const statusInfo = statusLabels[live.status as keyof typeof statusLabels];
    const visibilityInfo = visibilityLabels[live.visibility as keyof typeof visibilityLabels];
    const StatusIcon = statusInfo.icon;

    const liveDate = new Date(`${live.scheduledDate}T${live.scheduledTime}`);
    const isToday = liveDate.toDateString() === new Date().toDateString();
    const isPast = liveDate < new Date();

    return (
      <Card key={live.id} className="group hover:shadow-elevated transition-smooth">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg line-clamp-1">{live.title}</CardTitle>
                <Badge className={statusInfo.color} variant="outline">
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              <CardDescription className="text-sm line-clamp-2">
                {live.description}
              </CardDescription>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEditLive(live)}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Data e Hora */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <div>
                  <p className={isToday ? "text-primary font-medium" : ""}>
                    {liveDate.toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs">
                    {isToday ? "Hoje" : isPast ? "Finalizada" : "Agendada"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <div>
                  <p>{live.scheduledTime}</p>
                  <p className="text-xs">{live.duration} min</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {live.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Participantes e Visibilidade */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{live.registrations}/{live.maxParticipants} inscritos</span>
              </div>
              
              <Badge className={visibilityInfo.color} variant="outline">
                {visibilityInfo.label}
              </Badge>
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2 border-t border-border">
              {live.status === "live" && (
                <Button size="sm" className="flex-1 bg-red-500 hover:bg-red-600">
                  <Radio className="w-3 h-3 mr-1" />
                  Entrar na Live
                </Button>
              )}
              
              {live.status === "scheduled" && (
                <>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Bell className="w-3 h-3 mr-1" />
                    Lembrete
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Play className="w-3 h-3 mr-1" />
                    Iniciar Live
                  </Button>
                </>
              )}
              
              {live.status === "ended" && (
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={live.youtubeUrl} target="_blank" rel="noopener noreferrer">
                    <Youtube className="w-3 h-3 mr-1" />
                    Ver Gravação
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showLiveForm) {
    return (
      <LiveForm 
        live={selectedLive}
        onBack={() => setShowLiveForm(false)}
        onSave={() => {
          setShowLiveForm(false);
          carregarLives();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar lives por título, descrição ou tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0">
                <Settings className="w-4 h-4 mr-2" />
                Configurações YouTube
              </Button>
              <Button onClick={handleCreateNew} className="shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Nova Live
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{lives.filter(l => l.status === 'scheduled').length}</p>
                <p className="text-xs text-muted-foreground">Agendadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Radio className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{lives.filter(l => l.status === 'live').length}</p>
                <p className="text-xs text-muted-foreground">Ao Vivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{lives.reduce((acc, l) => acc + l.registrations, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Inscrições</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Youtube className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{lives.filter(l => l.status === 'ended').length}</p>
                <p className="text-xs text-muted-foreground">Gravações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredLives.map(renderLiveCard)}
      </div>

      {/* Empty State */}
      {filteredLives.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma live encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira live no YouTube para engajar seus alunos.
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Agendar Primeira Live
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveManager;