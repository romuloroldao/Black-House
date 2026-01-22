import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Dumbbell, UtensilsCrossed, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (section: string, id?: string) => void;
}

interface SearchResult {
  id: string;
  type: 'aluno' | 'treino' | 'dieta' | 'video';
  title: string;
  subtitle?: string;
  icon: any;
}

const SearchDialog = ({ open, onOpenChange, onNavigate }: SearchDialogProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      await performSearch(query);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!user) return;
    
    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Buscar alunos
      const alunosData = await apiClient
        .from('alunos')
        .select('id, nome, email')
        .eq('coach_id', user.id)
        .ilike('nome', `%${searchQuery}%`)
        .limit(5);

      const alunos = Array.isArray(alunosData) ? alunosData : [];
      searchResults.push(...alunos.map(a => ({
        id: a.id,
        type: 'aluno' as const,
        title: a.nome,
        subtitle: a.email,
        icon: Users
      })));

      // Buscar treinos
      const treinosData = await apiClient
        .from('treinos')
        .select('id, nome, descricao')
        .eq('coach_id', user.id)
        .ilike('nome', `%${searchQuery}%`)
        .limit(5);

      const treinos = Array.isArray(treinosData) ? treinosData : [];
      searchResults.push(...treinos.map(t => ({
        id: t.id,
        type: 'treino' as const,
        title: t.nome,
        subtitle: t.descricao,
        icon: Dumbbell
      })));

      // Buscar vídeos
      const videosData = await apiClient
        .from('videos')
        .select('id, titulo, descricao')
        .eq('coach_id', user.id)
        .ilike('titulo', `%${searchQuery}%`)
        .limit(5);

      const videos = Array.isArray(videosData) ? videosData : [];
      searchResults.push(...videos.map(v => ({
        id: v.id,
        type: 'video' as const,
        title: v.titulo,
        subtitle: v.descricao,
        icon: Video
      })));

      // Buscar dietas
      const dietasData = await apiClient
        .from('dietas')
        .select('id, nome, objetivo')
        .ilike('nome', `%${searchQuery}%`)
        .limit(5);

      const dietas = Array.isArray(dietasData) ? dietasData : [];
      searchResults.push(...dietas.map(d => ({
        id: d.id,
        type: 'dieta' as const,
        title: d.nome,
        subtitle: d.objetivo,
        icon: UtensilsCrossed
      })));

      setResults(searchResults);
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'aluno':
        onNavigate?.('students', result.id);
        break;
      case 'treino':
        onNavigate?.('workouts', result.id);
        break;
      case 'video':
        onNavigate?.('videos', result.id);
        break;
      case 'dieta':
        onNavigate?.('nutrition', result.id);
        break;
    }
    onOpenChange(false);
    setQuery("");
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'aluno': return 'default';
      case 'treino': return 'secondary';
      case 'video': return 'outline';
      case 'dieta': return 'default';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'aluno': return 'Aluno';
      case 'treino': return 'Treino';
      case 'video': return 'Vídeo';
      case 'dieta': return 'Dieta';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buscar</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar alunos, treinos, vídeos ou dietas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8"
              onClick={() => setQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Buscando...
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => {
                const Icon = result.icon;
                return (
                  <Button
                    key={`${result.type}-${result.id}`}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="mt-1">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.title}</span>
                          <Badge variant={getTypeBadgeVariant(result.type)}>
                            {getTypeLabel(result.type)}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
