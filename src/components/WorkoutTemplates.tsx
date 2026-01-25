import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Star, 
  Clock, 
  Dumbbell, 
  Target, 
  Copy,
  Heart,
  TrendingUp,
  Zap,
  Activity
} from "lucide-react";

interface WorkoutTemplatesProps {
  onUseTemplate: (template: any) => void;
}

const WorkoutTemplates = ({ onUseTemplate }: WorkoutTemplatesProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarTemplates();
  }, []);

  const carregarTemplates = async () => {
    const result = await apiClient.requestSafe<any[]>('/api/treinos');
    const data = result.success && Array.isArray(result.data) ? result.data : [];
    const filtrados = data
      .filter((t: any) => t && t.is_template === true)
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    const templatesFormatados = filtrados.map((template: any) => ({
      id: template.id,
      name: template.nome,
      description: template.descricao || '',
      category: template.categoria,
      difficulty: template.dificuldade,
      duration: template.duracao,
      exercises: template.num_exercicios,
      rating: 4.5,
      uses: 0,
      tags: Array.isArray(template.tags) ? template.tags : [],
      icon: TrendingUp,
      color: 'bg-primary'
    }));

    setTemplates(templatesFormatados);
    setLoading(false);
  };

  const categories = [
    { id: "all", label: "Todos" },
    { id: "Hipertrofia", label: "Hipertrofia" },
    { id: "Força", label: "Força" },
    { id: "Cardio", label: "Cardio" },
    { id: "Funcional", label: "Funcional" }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Iniciante": return "bg-primary/10 text-primary border-primary/20";
      case "Intermediário": return "bg-warning/10 text-warning border-warning/20";
      case "Avançado": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < Math.floor(rating) 
            ? "text-yellow-500 fill-yellow-500" 
            : "text-muted-foreground"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar templates por nome, categoria ou tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Popular Templates */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" />
          <h2 className="text-xl font-semibold">Templates Populares</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => {
            const IconComponent = template.icon;
            
            return (
              <Card key={template.id} className="group hover:shadow-elevated transition-smooth overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${template.color} rounded-lg flex items-center justify-center text-white`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          {renderStars(template.rating)}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({template.uses} usos)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-sm line-clamp-2 mt-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {template.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{template.duration}min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Dumbbell className="w-3 h-3" />
                      <span className="text-xs">{template.exercises} ex.</span>
                    </div>
                    <Badge className={getDifficultyColor(template.difficulty)} variant="outline">
                      <span className="text-xs">{template.difficulty}</span>
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {/* Preview functionality */}}
                    >
                      Visualizar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => onUseTemplate(template)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Usar Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground">
              Tente ajustar sua busca ou filtros para encontrar o template ideal.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkoutTemplates;