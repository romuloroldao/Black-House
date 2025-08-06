import { useState } from "react";
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

  // Mock templates - seria substituído por dados do Supabase
  const templates = [
    {
      id: 1,
      name: "Push Day Completo",
      description: "Treino completo para peito, ombros e tríceps com foco em hipertrofia",
      category: "Hipertrofia",
      difficulty: "Intermediário",
      duration: 75,
      exercises: 9,
      rating: 4.8,
      uses: 142,
      tags: ["Push", "Peito", "Ombros", "Tríceps"],
      icon: TrendingUp,
      color: "bg-blue-500"
    },
    {
      id: 2,
      name: "HIIT Fat Burn",
      description: "Circuito de alta intensidade para máxima queima calórica",
      category: "Cardio",
      difficulty: "Avançado",
      duration: 25,
      exercises: 8,
      rating: 4.9,
      uses: 89,
      tags: ["HIIT", "Cardio", "Queima", "Circuito"],
      icon: Zap,
      color: "bg-orange-500"
    },
    {
      id: 3,
      name: "Funcional Básico",
      description: "Movimentos funcionais para iniciantes com foco em mobilidade",
      category: "Funcional",
      difficulty: "Iniciante",
      duration: 40,
      exercises: 12,
      rating: 4.6,
      uses: 203,
      tags: ["Funcional", "Mobilidade", "Básico"],
      icon: Activity,
      color: "bg-green-500"
    },
    {
      id: 4,
      name: "Pull Day Power",
      description: "Treino intenso para costas e bíceps com foco em força",
      category: "Força",
      difficulty: "Avançado",
      duration: 80,
      exercises: 8,
      rating: 4.7,
      uses: 76,
      tags: ["Pull", "Costas", "Bíceps", "Força"],
      icon: Target,
      color: "bg-purple-500"
    },
    {
      id: 5,
      name: "Leg Day Hipertrofia",
      description: "Treino completo de membros inferiores para volume muscular",
      category: "Hipertrofia",
      difficulty: "Intermediário",
      duration: 90,
      exercises: 10,
      rating: 4.5,
      uses: 158,
      tags: ["Pernas", "Quadríceps", "Glúteos", "Volume"],
      icon: TrendingUp,
      color: "bg-red-500"
    },
    {
      id: 6,
      name: "Core & Stability",
      description: "Fortalecimento do core e melhora da estabilidade corporal",
      category: "Funcional",
      difficulty: "Intermediário",
      duration: 35,
      exercises: 15,
      rating: 4.4,
      uses: 94,
      tags: ["Core", "Estabilidade", "Abdomen"],
      icon: Heart,
      color: "bg-pink-500"
    }
  ];

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
      case "Iniciante": return "bg-success/10 text-success border-success/20";
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